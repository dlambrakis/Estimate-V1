// src/backend/routes/userRoutes.js
import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/authMiddleware.js'; // Adjusted path
import { registerUser, deleteUser } from '../services/authService.js'; // Adjusted path (contains user creation/deletion logic)
// Potentially add a userService if more user-specific actions are needed beyond auth

const router = express.Router();

// POST /api/users - Create a new user (e.g., by a Company Admin for their company)
// This endpoint assumes the admin provides necessary details like email, password, and potentially role/company association.
router.post('/', authenticateToken, authorizeRole(['company_admin', 'reseller_admin', 'global_admin']), async (req, res) => {
    const { email, password, role, company_id } = req.body; // Expect these fields
    const requestingUser = req.user; // User making the request (from JWT)

    console.log(`UserRoutes: User ${requestingUser.id} (${requestingUser.role}) attempting to create user:`, { email, role, company_id });

    // --- Authorization & Validation ---
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    let targetCompanyId = company_id;
    let targetRole = role || 'company_user'; // Default role if not provided? Or require it? Let's require it for clarity.

     if (!role) {
         return res.status(400).json({ message: 'User role is required.' });
     }

    // Company Admin can only create users for their own company and typically only 'company_user' role.
    if (requestingUser.role === 'company_admin') {
        // Fetch the requesting admin's company ID to ensure they are adding to their own company
        try {
            const { data: adminUser, error: adminFetchError } = await supabase
                .from('users')
                .select('company_id')
                .eq('id', requestingUser.id)
                .single();

            if (adminFetchError || !adminUser || !adminUser.company_id) {
                 console.error(`UserRoutes: Failed to fetch company ID for admin ${requestingUser.id}:`, adminFetchError);
                 return res.status(403).json({ message: 'Forbidden: Could not verify your company affiliation.' });
            }

            // If company_id was provided in request, ensure it matches admin's company
            if (targetCompanyId && targetCompanyId !== adminUser.company_id) {
                console.warn(`UserRoutes: Company Admin ${requestingUser.id} attempted to add user to wrong company (${targetCompanyId} instead of ${adminUser.company_id})`);
                return res.status(403).json({ message: 'Forbidden: You can only add users to your own company.' });
            }
             // If company_id wasn't provided, assign the admin's company
             targetCompanyId = adminUser.company_id;


            // Company Admins should likely only create 'company_user' roles within their company
            // Or maybe other 'company_admin' roles? Define the policy here.
            // For now, let's restrict them to 'company_user'.
            // if (targetRole !== 'company_user') {
            //     console.warn(`UserRoutes: Company Admin ${requestingUser.id} attempted to create user with role ${targetRole}`);
            //     return res.status(403).json({ message: 'Forbidden: You can only create users with the "company_user" role.' });
            // }
             // Let's allow CA to create other CAs or users for now, relying on service logic if needed
             console.log(`UserRoutes: Company Admin ${requestingUser.id} creating user for their company ${targetCompanyId}`);


        } catch (fetchError) {
             console.error(`UserRoutes: Error verifying company admin's company:`, fetchError);
             return res.status(500).json({ message: 'Failed to verify admin permissions.' });
        }

         if (!targetCompanyId) {
             return res.status(400).json({ message: 'Company association is required.' });
         }

    } else if (requestingUser.role === 'reseller_admin') {
        // Reseller Admin needs validation: Can they create users? For which companies? Which roles?
        // Requires checking if the targetCompanyId belongs to their managed companies.
        // TODO: Implement validation logic for Reseller Admin user creation
        console.warn("UserRoutes: User creation by Reseller Admin not fully implemented yet.");
        // return res.status(501).json({ message: 'User creation by Reseller Admin not implemented.' });
         if (!targetCompanyId) {
             return res.status(400).json({ message: 'Target company ID is required for Reseller Admin.' });
         }
         // Add check: Does targetCompanyId belong to this reseller?
    } else if (requestingUser.role === 'global_admin') {
        // Global Admin can likely create any user type for any company (or no company initially)
        console.log(`UserRoutes: Global Admin ${requestingUser.id} creating user.`);
         if (!targetCompanyId && (role === 'company_admin' || role === 'company_user')) {
              return res.status(400).json({ message: 'Company ID is required for company-related roles.' });
         }
    }
    // --- End Authorization & Validation ---


    try {
        // Call the authService function to handle Supabase Auth user creation and public.users sync/update
        const newUser = await registerUser(email, password, targetRole, targetCompanyId);
        console.log(`UserRoutes: User created successfully by ${requestingUser.id}:`, newUser.id);

        // Don't send back the full user object from Supabase Admin, select necessary fields
        res.status(201).json({
            id: newUser.id,
            email: newUser.email,
            role: newUser.user_metadata.role, // Role from metadata
            company_id: targetCompanyId, // Include the company ID it was associated with
            message: 'User created successfully'
        });
    } catch (error) {
        console.error(`UserRoutes: Failed to create user by ${requestingUser.id}:`, error);
        if (error.message.includes('already exists')) {
            res.status(409).json({ message: error.message }); // 409 Conflict
        } else if (error.message.includes('Forbidden')) {
             res.status(403).json({ message: error.message });
        } else if (error.message.includes('required')) {
             res.status(400).json({ message: error.message });
        }
        else {
            res.status(500).json({ message: error.message || 'Failed to create user.' });
        }
    }
});

// DELETE /api/users/:userId - Delete a user (e.g., by a Company Admin for their company user)
router.delete('/:userId', authenticateToken, authorizeRole(['company_admin', 'reseller_admin', 'global_admin']), async (req, res) => {
    const userIdToDelete = req.params.userId;
    const requestingUser = req.user;

    console.log(`UserRoutes: User ${requestingUser.id} (${requestingUser.role}) attempting to delete user ${userIdToDelete}`);

    // --- Authorization & Validation ---
     if (userIdToDelete === requestingUser.id) {
         return res.status(400).json({ message: "You cannot delete your own account using this endpoint." });
     }

    // Company Admin can only delete users from their own company.
    if (requestingUser.role === 'company_admin') {
        try {
            // 1. Get requesting admin's company ID
            const { data: adminUser, error: adminFetchError } = await supabase
                .from('users')
                .select('company_id')
                .eq('id', requestingUser.id)
                .single();

             if (adminFetchError || !adminUser || !adminUser.company_id) {
                 throw new Error('Forbidden: Could not verify your company affiliation.');
             }
             const adminCompanyId = adminUser.company_id;

            // 2. Get the company ID of the user to be deleted
            const { data: targetUser, error: targetFetchError } = await supabase
                .from('users')
                .select('company_id, role') // Also fetch role to prevent deleting other admins?
                .eq('id', userIdToDelete)
                .single();

            if (targetFetchError) {
                 // Handle case where user doesn't exist in public.users but might in auth.users
                 if (targetFetchError.code === 'PGRST116') { // PostgREST code for "Not found"
                      console.warn(`UserRoutes: User ${userIdToDelete} not found in public.users table.`);
                      // Allow deletion from auth.users anyway? Or deny? Let's deny for consistency.
                      // If you allow, the authService.deleteUser will handle auth.users deletion.
                      // The trigger should handle the (now non-existent) public.users row gracefully.
                      // Let's proceed to deleteUser service, but maybe log this.
                 } else {
                    throw new Error('Failed to verify target user affiliation.');
                 }
            }

             // 3. Check if target user belongs to the admin's company
             if (targetUser && targetUser.company_id !== adminCompanyId) {
                 console.warn(`UserRoutes: Company Admin ${requestingUser.id} attempted to delete user ${userIdToDelete} from different company (${targetUser.company_id})`);
                 throw new Error('Forbidden: You can only delete users from your own company.');
             }

             // Optional: Prevent Company Admins from deleting other Company Admins?
             // if (targetUser && targetUser.role === 'company_admin') {
             //     console.warn(`UserRoutes: Company Admin ${requestingUser.id} attempted to delete another admin ${userIdToDelete}`);
             //     throw new Error('Forbidden: Cannot delete another Company Admin.');
             // }


        } catch (authError) {
             console.error(`UserRoutes: Authorization error during delete for user ${userIdToDelete} by admin ${requestingUser.id}:`, authError);
             return res.status(authError.message.includes('Forbidden') ? 403 : 500).json({ message: authError.message });
        }
    } else if (requestingUser.role === 'reseller_admin') {
        // TODO: Implement validation for Reseller Admin user deletion
        // Check if target user's company belongs to the reseller.
        console.warn("UserRoutes: User deletion by Reseller Admin not fully implemented yet.");
        // return res.status(501).json({ message: 'User deletion by Reseller Admin not implemented.' });
    } else if (requestingUser.role === 'global_admin') {
        // Global Admin can delete (almost) anyone, except maybe other Global Admins?
        // Add check if target user is also global_admin?
        console.log(`UserRoutes: Global Admin ${requestingUser.id} proceeding to delete user ${userIdToDelete}.`);
    }
     // --- End Authorization & Validation ---


    try {
        // Call the service function to handle Supabase Auth user deletion
        await deleteUser(userIdToDelete, requestingUser.id); // Pass requesting user ID for logging/checks
        console.log(`UserRoutes: User ${userIdToDelete} deleted successfully by ${requestingUser.id}.`);
        res.status(200).json({ message: 'User deleted successfully' }); // Or 204 No Content
    } catch (error) {
        console.error(`UserRoutes: Failed to delete user ${userIdToDelete} by ${requestingUser.id}:`, error);
        if (error.message.includes('Cannot delete the user associated')) {
             res.status(400).json({ message: error.message });
        } else if (error.message.includes('not found')) {
            res.status(404).json({ message: error.message });
        } else if (error.message.includes('Forbidden')) {
             res.status(403).json({ message: error.message });
        }
        else {
            res.status(500).json({ message: error.message || 'Failed to delete user.' });
        }
    }
});


// GET /api/users - Get a list of users (likely for Global/Reseller Admins, with filtering)
// Add authorizeRole(['reseller_admin', 'global_admin'])
// Implement service function with filtering/pagination based on role and query params

// GET /api/users/:userId - Get details for a specific user (for Admins)
// Add authorizeRole(['company_admin', 'reseller_admin', 'global_admin'])
// Implement service function with authorization checks (can CA see their user? Can RA see users in their companies?)

// PUT /api/users/:userId - Update a user (for Admins)
// Add authorizeRole(['company_admin', 'reseller_admin', 'global_admin'])
// Implement service function with authorization checks and handle updates (role changes, company changes?)


export default router;
