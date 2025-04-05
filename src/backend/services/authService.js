import { supabase, supabaseAdmin } from '../../config/supabaseClient.js'; // Adjusted path
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid'; // If needed for custom logic, though Supabase handles IDs

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h'; // Default to 1 hour expiry

if (!JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables for AuthService.");
    // process.exit(1); // Or handle appropriately
}

export const loginUser = async (email, password) => {
    console.log(`AuthService: Attempting login for email: ${email}`);
    try {
        // 1. Sign in using Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error("AuthService: Supabase signInWithPassword error:", error.message);
            // Map Supabase errors to more generic messages if desired
            if (error.message.includes('Invalid login credentials')) {
                 throw new Error('Invalid email or password.');
            }
            throw new Error(error.message || 'Login failed.');
        }

        if (!data || !data.user || !data.session) {
            console.error("AuthService: Supabase signInWithPassword returned no data/user/session.");
            throw new Error('Login failed: Could not retrieve user session.');
        }

        console.log("AuthService: Supabase login successful for user:", data.user.id);

        // 2. Retrieve user profile/role information (if not already in JWT claims)
        //    Supabase JWT *should* contain the role if set in user_metadata.
        //    No need to fetch profile separately unless more data is required immediately.

        // 3. Return the necessary data: session (contains JWT) and user object
        return {
            user: data.user,
            session: data.session,
        };

    } catch (error) {
        console.error("AuthService: Error in loginUser:", error.message);
        // Re-throw the specific error message caught or a generic one
        throw new Error(error.message || 'An unexpected error occurred during login.');
    }
};


// Function to register a new user (potentially by an admin)
// Creates user in Supabase Auth AND inserts into public.users table.
// Requires ADMIN privileges.
export const registerUser = async (email, password, role, companyId = null, firstName = null, lastName = null) => {
    if (!supabaseAdmin) {
        throw new Error("Admin client not available. Cannot register user administratively.");
    }
    // Ensure role is lowercase for consistency
    const standardizedRole = role ? String(role).toLowerCase() : null;
    if (!standardizedRole) {
        console.error("AuthService: Attempted to register user without a valid role.");
        throw new Error("User registration requires a valid role.");
    }

    console.log(`AuthService: Attempting to register user ${email} with role ${standardizedRole} for company ${companyId || 'N/A'}`);

    let newUser = null; // To hold the created auth user data

    try {
        // 1. Create user in Supabase Auth using Admin client
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true, // Auto-confirm email since admin is creating
            user_metadata: {
                role: standardizedRole, // Store STANDARDIZED (lowercase) role
                // Add first/last name to metadata if desired, though primary storage is public.users
                // first_name: firstName,
                // last_name: lastName,
            },
        });

        if (authError) {
            console.error("AuthService: Supabase admin.createUser error:", authError.message);
             if (authError.message.includes('User already registered')) {
                 throw new Error('User with this email already exists in Auth.');
             }
            throw new Error(authError.message || 'Failed to create user in Auth.');
        }

        newUser = authData.user;
        console.log(`AuthService: User created successfully in Auth: ${newUser.id}`);

        // 2. Explicitly insert into public.users table
        console.log(`AuthService: Attempting to insert user ${newUser.id} into public.users`);
        const { error: insertError } = await supabaseAdmin
            .from('users')
            .insert({
                id: newUser.id, // Use the ID from the created Auth user
                email: newUser.email,
                role: standardizedRole, // Use the standardized role
                company_id: companyId, // Can be null if not applicable (e.g., global admin)
                first_name: firstName,
                last_name: lastName,
                // is_active defaults to true via DB default
                // license_consumed defaults to false via DB default
                // created_at/updated_at handled by DB defaults/triggers
            });

        if (insertError) {
            console.error(`AuthService: Failed to insert user ${newUser.id} into public.users:`, insertError.message);
            // CRITICAL: Rollback Auth user creation if public.users insert fails
            console.log(`AuthService: Rolling back Auth user creation for ${newUser.id} due to public.users insert failure.`);
            const { error: deleteAuthUserError } = await supabaseAdmin.auth.admin.deleteUser(newUser.id);
            if (deleteAuthUserError) {
                console.error(`AuthService: CRITICAL FAILURE - Failed to rollback Auth user ${newUser.id} after public.users insert error:`, deleteAuthUserError.message);
                // This is a problematic state - user exists in Auth but not public.users. Manual intervention needed.
                throw new Error(`Failed to insert user into profile table, and failed to rollback Auth user creation. User ID: ${newUser.id}. Please contact support.`);
            }
            // Throw the original insert error after successful rollback
            if (insertError.message.includes('duplicate key value violates unique constraint "users_pkey"')) {
                 throw new Error(`User with ID ${newUser.id} already exists in the users table.`);
            }
            if (insertError.message.includes('violates foreign key constraint "users_company_id_fkey"')) {
                 throw new Error(`Invalid Company ID provided: ${companyId}.`);
            }
            throw new Error(`Failed to create user profile: ${insertError.message}`);
        }

        console.log(`AuthService: Successfully inserted user ${newUser.id} into public.users`);

        // 3. Return the newly created user object (from Auth)
        return newUser;

    } catch (error) {
        console.error("AuthService: Error in registerUser:", error.message);
        // If an error occurred after auth user creation but before/during public.users insert,
        // the rollback attempt should have happened. Re-throw the caught error.
        throw new Error(error.message || 'An unexpected error occurred during user registration.');
    }
};

// Function to delete a user (requires ADMIN privileges)
// Deletes from public.users first, then from auth.users.
export const deleteUser = async (userIdToDelete, requestingUserId) => {
     if (!supabaseAdmin) {
         throw new Error("Admin client not available. Cannot delete user administratively.");
     }
     console.log(`AuthService: User ${requestingUserId} attempting to delete user ${userIdToDelete}`);

     // Prevent self-deletion through this admin function if needed
     if (userIdToDelete === requestingUserId) {
         console.warn(`AuthService: User ${requestingUserId} attempted self-deletion via admin route.`);
         throw new Error("Cannot delete your own account using this administrative function.");
     }

     try {
         // 1. Delete from public.users first
         console.log(`AuthService: Attempting to delete user ${userIdToDelete} from public.users`);
         const { error: deleteProfileError } = await supabaseAdmin
             .from('users')
             .delete()
             .eq('id', userIdToDelete);

         if (deleteProfileError) {
             console.error(`AuthService: Failed to delete user ${userIdToDelete} from public.users:`, deleteProfileError.message);
             // If the user wasn't found in public.users, maybe proceed to delete from Auth anyway?
             // Or stop here? Let's stop here to be safe, as state might be inconsistent.
             throw new Error(`Failed to delete user profile: ${deleteProfileError.message}`);
         }
         console.log(`AuthService: Successfully deleted user ${userIdToDelete} from public.users.`);

         // 2. Delete from auth.users
         console.log(`AuthService: Attempting to delete user ${userIdToDelete} from auth.users`);
         const { data: deleteAuthData, error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete);

         if (deleteAuthError) {
             console.error(`AuthService: Supabase admin.deleteUser error for user ${userIdToDelete}:`, deleteAuthError.message);
             // CRITICAL: What if public.users delete succeeded but auth.users delete failed?
             // This leaves an orphaned auth user. This scenario *should* be less likely than the insert failure.
             // Log this as a critical warning. Manual cleanup might be needed.
             console.warn(`AuthService: CRITICAL WARNING - User ${userIdToDelete} deleted from public.users, but FAILED to delete from auth.users: ${deleteAuthError.message}. Manual cleanup required.`);
             // Re-throw the error
             if (deleteAuthError.message.includes('User not found')) {
                 // This is odd if public.users delete succeeded, but possible in race conditions or inconsistent state.
                 throw new Error('User profile deleted, but user not found in authentication system.');
             }
             throw new Error(`Failed to delete user from authentication system: ${deleteAuthError.message}`);
         }

         console.log(`AuthService: User ${userIdToDelete} deleted successfully from auth.users by ${requestingUserId}.`);
         return { message: "User deleted successfully" };

     } catch (error) {
         console.error(`AuthService: Error in deleteUser for user ${userIdToDelete}:`, error.message);
         // Re-throw the specific error message caught or a generic one
         throw new Error(error.message || 'An unexpected error occurred during user deletion.');
     }
};
