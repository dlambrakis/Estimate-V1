/*
      # Fix handle_new_user Trigger v2

      This migration updates the `handle_new_user` trigger function.

      1.  **Changes:**
          *   Corrected the logic for linking a `reseller_admin`. It now correctly queries the `resellers` table using `NEW.raw_user_meta_data->>'reseller_id'` to find the matching reseller and updates the `users.reseller_id` column.
          *   Added explicit `RETURN NEW;` at the end of the function.
          *   Ensured consistent use of `NEW.id` for the user being created/updated.

      2.  **Reasoning:**
          *   The previous version incorrectly tried to link the reseller based on `admin_user_id` *before* the user ID was necessarily assigned or available in the context of the trigger, leading to `users.reseller_id` remaining null for Reseller Admins.
          *   This version uses the `reseller_id` provided in the metadata during user creation (via Admin API) to establish the link.
    */

    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER -- Necessary to update the users table
    -- Set a secure search_path: IMPORTANT to prevent search_path attacks
    SET search_path = public
    AS $$
    DECLARE
      user_role text := NEW.raw_user_meta_data->>'role';
      input_company_id uuid;
      input_reseller_id uuid;
    BEGIN
      RAISE LOG 'handle_new_user trigger fired for user % with role %', NEW.id, user_role;

      -- Always insert/update the base user data from auth.users into public.users
      -- Use ON CONFLICT to handle potential updates if the trigger fires multiple times for the same user
      INSERT INTO public.users (id, email, role, first_name, last_name, is_active)
      VALUES (
        NEW.id,
        NEW.email,
        user_role::user_role, -- Cast role from metadata
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        true -- Default to active
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        -- Avoid resetting company_id/reseller_id if already set by subsequent logic
        updated_at = now(); -- Ensure updated_at is touched

      -- Link company if role is company_admin or company_user
      IF user_role IN ('company_admin', 'company_user') THEN
        input_company_id := (NEW.raw_user_meta_data->>'company_id')::uuid;
        RAISE LOG 'Attempting to link company % for user %', input_company_id, NEW.id;
        IF input_company_id IS NOT NULL THEN
          UPDATE public.users
          SET company_id = input_company_id
          WHERE id = NEW.id;
          RAISE LOG 'Linked company % for user %', input_company_id, NEW.id;

          -- If it's a Company Admin, also update the companies table admin_user_id
          IF user_role = 'company_admin' THEN
             RAISE LOG 'Attempting to set admin_user_id % for company %', NEW.id, input_company_id;
             UPDATE public.companies
             SET admin_user_id = NEW.id
             WHERE id = input_company_id;
             RAISE LOG 'Set admin_user_id % for company %', NEW.id, input_company_id;
          END IF;
        ELSE
           RAISE LOG 'No company_id provided in metadata for company user/admin %', NEW.id;
        END IF;

      -- Link reseller if role is reseller_admin
      ELSIF user_role = 'reseller_admin' THEN
        input_reseller_id := (NEW.raw_user_meta_data->>'reseller_id')::uuid;
        RAISE LOG 'Attempting to link reseller % for user %', input_reseller_id, NEW.id;
        IF input_reseller_id IS NOT NULL THEN
          -- Update the user's reseller_id
          UPDATE public.users
          SET reseller_id = input_reseller_id
          WHERE id = NEW.id;
          RAISE LOG 'Linked reseller % in users table for user %', input_reseller_id, NEW.id;

          -- Update the reseller's admin_user_id
          RAISE LOG 'Attempting to set admin_user_id % for reseller %', NEW.id, input_reseller_id;
          UPDATE public.resellers
          SET admin_user_id = NEW.id
          WHERE id = input_reseller_id;
          RAISE LOG 'Set admin_user_id % for reseller %', NEW.id, input_reseller_id;
        ELSE
           RAISE LOG 'No reseller_id provided in metadata for reseller admin %', NEW.id;
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$;

    -- Re-grant execute permission
    GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

    -- Ensure the trigger exists and points to the updated function
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
