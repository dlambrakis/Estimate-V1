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
            //    If you need more profile data immediately after login, fetch it here.
            //    Example: Fetching from a 'profiles' table (ensure RLS allows this)
            // const { data: profileData, error: profileError } = await supabase
            //     .from('profiles') // Assuming a 'profiles' table linked to auth.users
            //     .select('*')
            //     .eq('id', data.user.id)
            //     .single();

            // if (profileError) {
            //     console.error("AuthService: Error fetching user profile:", profileError.message);
            //     // Decide if login should fail if profile is missing
            //     throw new Error('Login successful, but failed to retrieve profile.');
            // }
            // console.log("AuthService: User profile data:", profileData);


            // 3. Return the necessary data: usually the session (contains JWT) and user object
            //    The Supabase client library handles JWT generation internally based on its auth flow.
            //    We don't typically generate a *separate* JWT here unless we have specific reasons
            //    to override Supabase's token. The token is in `data.session.access_token`.

            return {
                user: data.user,
                session: data.session,
                // profile: profileData // Include profile if fetched
            };

        } catch (error) {
            console.error("AuthService: Error in loginUser:", error.message);
            // Re-throw the specific error message caught or a generic one
            throw new Error(error.message || 'An unexpected error occurred during login.');
        }
    };


    // Function to register a new user (potentially by an admin)
    // NOTE: This creates a user in Supabase Auth AND potentially a profile row.
    // Requires ADMIN privileges if bypassing standard signup flows.
    export const registerUser = async (email, password, role, companyId = null) => {
        if (!supabaseAdmin) {
            throw new Error("Admin client not available. Cannot register user administratively.");
        }
        // Ensure role is lowercase for consistency in metadata and JWT claims
        const standardizedRole = role ? String(role).toLowerCase() : null;
        if (!standardizedRole) {
            console.error("AuthService: Attempted to register user without a valid role.");
            throw new Error("User registration requires a valid role.");
        }

        console.log(`AuthService: Attempting to register user ${email} with standardized role ${standardizedRole} for company ${companyId || 'N/A'}`);

        try {
            // 1. Create user in Supabase Auth using Admin client
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email: email,
                password: password,
                email_confirm: true, // Auto-confirm email since admin is creating
                user_metadata: {
                    role: standardizedRole, // Store STANDARDIZED (lowercase) role in metadata
                    // Add other metadata if needed
                },
            });

            if (authError) {
                console.error("AuthService: Supabase admin.createUser error:", authError.message);
                 // Handle specific errors like user already exists
                 if (authError.message.includes('User already registered')) {
                     throw new Error('User with this email already exists.');
                 }
                throw new Error(authError.message || 'Failed to create user in Auth.');
            }

            const newUser = authData.user;
            console.log(`AuthService: User created successfully in Auth: ${newUser.id}`);

            // 2. IMPORTANT: Create corresponding entry in the public.users table
            //    This relies on the trigger `sync_public_users_from_auth` being active.
            //    However, the trigger might not capture the company_id association correctly
            //    if it's only passed here. We might need to explicitly insert/update the public.users row.
            //    ALSO: The trigger needs to handle the role casing difference until migrations run.
            //    Let's assume the trigger populates public.users.role based on the NEW standardized metadata role.

            // Let's try updating the public.users table directly after creation for company_id.
            // The trigger should have created the basic row.
            if (companyId) {
                 console.log(`AuthService: Attempting to associate user ${newUser.id} with company ${companyId}`);
                 const { error: updateError } = await supabaseAdmin
                     .from('users')
                     .update({ company_id: companyId })
                     .eq('id', newUser.id);

                 if (updateError) {
                     console.error(`AuthService: Failed to update company_id for user ${newUser.id}:`, updateError.message);
                     // Decide how to handle this: Rollback Auth user? Log warning?
                     // For now, log a warning. The user exists in Auth but might not be linked correctly.
                     console.warn(`WARNING: User ${email} created in Auth, but failed to link to company ${companyId}. Manual correction might be needed.`);
                     // Optionally, re-throw to indicate partial failure
                     // throw new Error(`User created, but failed to link to company: ${updateError.message}`);
                 } else {
                     console.log(`AuthService: Successfully associated user ${newUser.id} with company ${companyId}`);
                 }
            }


            // 3. Return the newly created user object (from Auth)
            return newUser;

        } catch (error) {
            console.error("AuthService: Error in registerUser:", error.message);
            throw new Error(error.message || 'An unexpected error occurred during user registration.');
        }
    };

    // Function to delete a user (requires ADMIN privileges)
    export const deleteUser = async (userIdToDelete, requestingUserId) => {
         if (!supabaseAdmin) {
             throw new Error("Admin client not available. Cannot delete user administratively.");
         }
         console.log(`AuthService: User ${requestingUserId} attempting to delete user ${userIdToDelete}`);

         // Prevent self-deletion through this admin function if needed
         if (userIdToDelete === requestingUserId) {
             console.warn(`AuthService: User ${requestingUserId} attempted self-deletion.`);
             throw new Error("Cannot delete the user associated with the current session"); // Or a more specific error
         }

         try {
             // Supabase handles deleting the user from auth.users.
             // The trigger `handle_deleted_user` *should* handle cleanup in public.users.
             const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete);

             if (error) {
                 console.error(`AuthService: Supabase admin.deleteUser error for user ${userIdToDelete}:`, error.message);
                 // Handle specific errors, e.g., user not found
                 if (error.message.includes('User not found')) {
                     throw new Error('User not found.');
                 }
                 throw new Error(error.message || 'Failed to delete user.');
             }

             console.log(`AuthService: User ${userIdToDelete} deleted successfully by ${requestingUserId}.`);
             return { message: "User deleted successfully" }; // Or return data if needed

         } catch (error) {
             console.error(`AuthService: Error in deleteUser for user ${userIdToDelete}:`, error.message);
             throw new Error(error.message || 'An unexpected error occurred during user deletion.');
         }
    };
