/*
      # Manual Update Reseller Admin Link

      This migration manually updates the `users` and `resellers` tables
      to correctly link the existing Reseller Admin user (`reseller@reseller.com`)
      to their corresponding reseller record.

      This is necessary because the `handle_new_user` trigger was previously
      bugged and did not correctly populate `users.reseller_id` or
      `resellers.admin_user_id` when the Reseller Admin user was created.

      1.  **Changes:**
          *   Updates `users.reseller_id` for the user with email `reseller@reseller.com` to the ID of the reseller named 'Test Reseller'.
          *   Updates `resellers.admin_user_id` for the reseller named 'Test Reseller' to the ID of the user with email `reseller@reseller.com`.

      2.  **Assumptions:**
          *   A user with email `reseller@reseller.com` exists.
          *   A reseller with name `Test Reseller` exists.
    */
    DO $$
    DECLARE
        reseller_admin_user_id uuid;
        test_reseller_id uuid;
    BEGIN
        -- Get the user ID for the reseller admin
        SELECT id INTO reseller_admin_user_id
        FROM public.users
        WHERE email = 'reseller@reseller.com'
        LIMIT 1;

        -- Get the reseller ID for 'Test Reseller'
        SELECT id INTO test_reseller_id
        FROM public.resellers
        WHERE name = 'Test Reseller'
        LIMIT 1;

        -- Proceed only if both IDs were found
        IF reseller_admin_user_id IS NOT NULL AND test_reseller_id IS NOT NULL THEN
            RAISE LOG 'Found Reseller Admin User ID: %', reseller_admin_user_id;
            RAISE LOG 'Found Test Reseller ID: %', test_reseller_id;

            -- Update the user's reseller_id
            UPDATE public.users
            SET reseller_id = test_reseller_id
            WHERE id = reseller_admin_user_id;
            RAISE LOG 'Updated users.reseller_id for user %', reseller_admin_user_id;

            -- Update the reseller's admin_user_id
            UPDATE public.resellers
            SET admin_user_id = reseller_admin_user_id
            WHERE id = test_reseller_id;
            RAISE LOG 'Updated resellers.admin_user_id for reseller %', test_reseller_id;
        ELSE
            RAISE WARNING 'Could not find Reseller Admin user (reseller@reseller.com) or Test Reseller. Manual update skipped.';
            IF reseller_admin_user_id IS NULL THEN
              RAISE LOG 'Reseller Admin user ID not found.';
            END IF;
            IF test_reseller_id IS NULL THEN
              RAISE LOG 'Test Reseller ID not found.';
            END IF;
        END IF;
    END $$;