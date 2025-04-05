import { supabaseAdmin } from './src/config/supabaseClient.js'; // Adjust path if needed

        // --- Configuration ---
        const userIdToUpdate = 'e102bfe6-bc8f-4ca5-9edb-c2d4decece43'; // The ID of globaladmin@test.com
        const newMetadata = {
            // IMPORTANT: Include existing metadata you want to keep!
            // Check the 'raw_user_meta_data' from your previous message.
            email_verified: true,
            // Add or update the role
            role: 'global_admin'
        };
        // --- End Configuration ---

        async function updateUserMetadata() {
            if (!supabaseAdmin) {
                console.error("❌ Error: Supabase Admin client is not initialized. Check SUPABASE_SERVICE_ROLE_KEY in your .env file.");
                return;
            }

            console.log(`🚀 Attempting to update metadata for user ID: ${userIdToUpdate}`);
            console.log("Setting metadata to:", newMetadata);

            try {
                const { data: updatedUser, error } = await supabaseAdmin.auth.admin.updateUserById(
                    userIdToUpdate,
                    { user_metadata: newMetadata }
                );

                if (error) {
                    console.error("❌ Error updating user metadata:", error.message);
                    // Log the full error object for more details if needed
                    // console.error(error);
                    return;
                }

                console.log("✅ Successfully updated user metadata!");
                console.log("Updated user data (metadata portion):", updatedUser.user.user_metadata);

            } catch (err) {
                console.error("❌ An unexpected error occurred:", err);
            }
        }

        updateUserMetadata();
