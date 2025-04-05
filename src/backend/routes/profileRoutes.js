// src/backend/routes/profileRoutes.js
    import express from 'express';
    import { authenticateToken } from '../middleware/authMiddleware.js'; // Adjusted path
    import { supabase } from '../../config/supabaseClient.js'; // Adjusted path

    const router = express.Router();

    // GET /api/profile/me - Get the profile of the currently logged-in user
    router.get('/me', authenticateToken, async (req, res) => {
        const userId = req.user.id; // User ID obtained from the verified JWT

        if (!userId) {
            return res.status(401).json({ message: 'User ID not found in token' });
        }

        console.log(`ProfileRoutes: Fetching profile for user ID: ${userId}`);

        try {
            // Fetch user data, joining with companies and resellers using explicit FK names
            console.log(`ProfileRoutes: Fetching user data with joins for ${userId}`);
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select(`
                    id,
                    email,
                    role,
                    first_name,
                    last_name,
                    is_active,
                    license_consumed,
                    created_at,
                    updated_at,
                    company_id,
                    reseller_id,
                    company:companies!fk_users_company ( * ),
                    reseller:resellers!users_reseller_id_fkey ( * )
                `)
                .eq('id', userId)
                .maybeSingle(); // Use maybeSingle as user might not exist (though unlikely after auth)

            if (userError) {
                console.error(`ProfileRoutes: Error fetching user profile with joins for ${userId}:`, userError);
                 if (userError.code === '42501') { // RLS Violation
                     console.error(`ProfileRoutes: RLS VIOLATION DETECTED fetching profile/joins for ${userId}. Check policies on users, companies, or resellers.`);
                     // Try to determine which join might have failed if possible, or return generic forbidden
                     return res.status(403).json({ message: 'Forbidden: RLS policy prevented access during profile fetch.', error: userError.message });
                 } else if (userError.code === 'PGRST201') { // Ambiguous relationship
                     console.error(`ProfileRoutes: Ambiguous relationship error (PGRST201) for user ${userId}. Check explicit FK naming in select().`);
                     return res.status(500).json({ message: 'Server configuration error: Ambiguous relationship.', error: userError.message });
                 } else if (userError.code === 'PGRST100') { // Parsing error (often syntax in select)
                     console.error(`ProfileRoutes: Parsing error (PGRST100) for user ${userId}. Check select() syntax.`);
                     return res.status(500).json({ message: 'Server configuration error: Query parsing failed.', error: userError.message });
                 }
                 // Handle other potential errors
                return res.status(500).json({ message: 'Failed to fetch user profile', error: userError.message });
            }

            if (!userData) {
                // This case should ideally not happen if authenticateToken works, but good to handle
                console.warn(`ProfileRoutes: No profile found in public.users for user ID: ${userId} even though authenticated.`);
                return res.status(404).json({ message: 'User profile not found' });
            }

            console.log(`ProfileRoutes: Successfully fetched profile with joins for user ID: ${userId}`);
            res.json(userData); // Send the profile data with potentially null company/reseller

        } catch (error) {
            console.error(`ProfileRoutes: Unexpected error fetching profile for ${userId}:`, error);
            res.status(500).json({ message: 'An unexpected error occurred', error: error.message });
        }
    });

    // PUT /api/profile/me - Update the profile of the currently logged-in user
    // Allows users to update their own first_name and last_name.
    router.put('/me', authenticateToken, async (req, res) => {
        const userId = req.user.id;
        const { first_name, last_name, ...otherUpdates } = req.body; // Extract allowed fields

        // Construct object with only allowed updates
        const updates = {};
        if (first_name !== undefined) updates.first_name = first_name;
        if (last_name !== undefined) updates.last_name = last_name;

        // Prevent updating other fields via this route
        if (Object.keys(otherUpdates).length > 0) {
             console.warn(`ProfileRoutes: User ${userId} attempted to update protected fields:`, Object.keys(otherUpdates));
        }


        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'No valid update data provided (only first_name, last_name allowed)' });
        }

        console.log(`ProfileRoutes: Attempting to update profile for user ${userId} with data:`, updates);

        try {
            // Update the user's row in public.users
            // RLS policy must allow users to update their own row for these specific columns.
            const { data, error } = await supabase
                .from('users')
                .update(updates)
                .eq('id', userId)
                .select('id, email, role, first_name, last_name, is_active, license_consumed, created_at, updated_at, company_id, reseller_id') // Select the updated row data
                .single(); // Expect a single row to be updated

            if (error) {
                console.error(`ProfileRoutes: Error updating profile for user ${userId}:`, error);
                if (error.code === '42501') { // RLS violation code
                     return res.status(403).json({ message: 'Forbidden: You do not have permission to update this profile.', error: error.message });
                }
                return res.status(500).json({ message: 'Failed to update profile', error: error.message });
            }

            console.log(`ProfileRoutes: Profile updated successfully for user ${userId}:`, data.id);
            // We don't need to re-fetch company/reseller here as they weren't updated
            res.json(data);

        } catch (error) {
            console.error(`ProfileRoutes: Unexpected error updating profile for ${userId}:`, error);
            res.status(500).json({ message: 'An unexpected error occurred', error: error.message });
        }
    });


    export default router;
