// src/backend/routes/profileRoutes.js
import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js'; // Adjusted path
import { supabase } from '../../config/supabaseClient.js'; // Adjusted path

const router = express.Router();

// GET /api/profile/me - Get the profile of the currently logged-in user
router.get('/me', authenticateToken, async (req, res) => {
    const userId = req.user.id; // User ID obtained from the verified JWT by authenticateToken middleware

    if (!userId) {
        // This should technically be caught by authenticateToken, but double-check
        return res.status(401).json({ message: 'User ID not found in token' });
    }

    console.log(`ProfileRoutes: Fetching profile for user ID: ${userId}`);

    try {
        // Fetch user data from the 'users' table (public schema) using the user ID
        // RLS policies on the 'users' table should allow users to select their own row.
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select(`
                id,
                email,
                role,
                created_at,
                updated_at,
                company_id,
                company:companies ( * )
            `) // Select user fields and related company data
            .eq('id', userId)
            .maybeSingle(); // Use maybeSingle() in case the profile doesn't exist yet

        if (userError) {
            console.error(`ProfileRoutes: Error fetching user profile for ${userId}:`, userError);
            // Check for specific errors, e.g., RLS violation (though unlikely for self-fetch if policy is correct)
            return res.status(500).json({ message: 'Failed to fetch user profile', error: userError.message });
        }

        if (!userData) {
            // This might happen if the user exists in auth.users but not yet in public.users
            // Or if RLS prevents access (check policies)
            console.warn(`ProfileRoutes: No profile found in public.users for user ID: ${userId}`);
            return res.status(404).json({ message: 'User profile not found' });
        }

        console.log(`ProfileRoutes: Successfully fetched profile for user ID: ${userId}`, userData);
        res.json(userData);

    } catch (error) {
        console.error(`ProfileRoutes: Unexpected error fetching profile for ${userId}:`, error);
        res.status(500).json({ message: 'An unexpected error occurred', error: error.message });
    }
});

// PUT /api/profile/me - Update the profile of the currently logged-in user
// Add this route if you need users to update their own profile information (e.g., email - careful with Supabase Auth sync, name, etc.)
// Ensure RLS policies allow users to update their own row in the 'users' table.
// router.put('/me', authenticateToken, async (req, res) => {
//     const userId = req.user.id;
//     const updates = req.body; // { email, name, etc. } - sanitize this input!

//     // Remove protected fields that shouldn't be updated directly by user
//     delete updates.id;
//     delete updates.role;
//     delete updates.company_id; // Company admins might update this via company routes, not profile route
//     delete updates.created_at;
//     delete updates.updated_at;

//     if (Object.keys(updates).length === 0) {
//         return res.status(400).json({ message: 'No update data provided' });
//     }

//     console.log(`ProfileRoutes: Attempting to update profile for user ${userId} with data:`, updates);

//     try {
//         // Update the user's row in public.users
//         const { data, error } = await supabase
//             .from('users')
//             .update(updates)
//             .eq('id', userId)
//             .select() // Select the updated row data
//             .single(); // Expect a single row to be updated

//         if (error) {
//             console.error(`ProfileRoutes: Error updating profile for user ${userId}:`, error);
//             // Handle RLS errors, constraint violations etc.
//             return res.status(500).json({ message: 'Failed to update profile', error: error.message });
//         }

//         console.log(`ProfileRoutes: Profile updated successfully for user ${userId}:`, data);
//         res.json(data);

//     } catch (error) {
//         console.error(`ProfileRoutes: Unexpected error updating profile for ${userId}:`, error);
//         res.status(500).json({ message: 'An unexpected error occurred', error: error.message });
//     }
// });


export default router;
