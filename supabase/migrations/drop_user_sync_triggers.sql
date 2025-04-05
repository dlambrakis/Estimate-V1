/*
  # Drop User Synchronization Triggers

  This migration removes the database triggers previously responsible for synchronizing data between `auth.users` and `public.users`. This logic is now handled explicitly in the backend `authService.js`.

  1.  **Dropped Triggers:**
      - `handle_new_user` on `auth.users`: No longer needed as `authService.registerUser` now inserts into `public.users`.
      - `handle_deleted_user` on `auth.users`: No longer needed as `authService.deleteUser` now deletes from `public.users` before deleting the auth user.

  2.  **Reasoning:**
      - Centralizes user creation/deletion logic in the backend service.
      - Improves control over the synchronization process, including error handling and potential rollbacks.
      - Simplifies debugging as the logic is in application code rather than database triggers.
*/

-- Drop the trigger that automatically created a public.users entry
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;

-- Drop the trigger that automatically deleted a public.users entry
DROP TRIGGER IF EXISTS handle_deleted_user ON auth.users;
