/*
      # Create or Replace handle_new_user Function and Trigger

      This migration ensures the trigger function (`handle_new_user`) exists and is up-to-date. It automatically inserts a corresponding record into the `public.users` table whenever a new user is created in `auth.users`. Uses `CREATE OR REPLACE` to avoid drop errors due to dependencies.

      1. Function Definition (`CREATE OR REPLACE`):
        - `public.handle_new_user()`:
          - Triggered after insert on `auth.users`.
          - Extracts user details (id, email) from the `NEW` record.
          - Extracts `first_name`, `last_name`, and `role` from `NEW.raw_user_meta_data`.
          - **Crucially, it expects the `role` in the metadata to be the correct lowercase enum value (e.g., 'global_admin', 'company_user').**
          - Inserts a new row into `public.users` with these details.
          - Includes basic error handling for missing or invalid role metadata.

      2. Trigger Definition (`CREATE TRIGGER IF NOT EXISTS`):
        - `on_auth_user_created`:
          - Executes `public.handle_new_user()` after each row insert on `auth.users`.
          - Added `IF NOT EXISTS` to prevent errors if the trigger already exists.

      3. Importance:
        - Ensures that every authenticated user has a corresponding profile in `public.users`.
        - Centralizes the logic for populating the initial user profile data.
        - Relies on user metadata being provided correctly during user creation (e.g., via Supabase API/curl).

      4. Assumptions & Potential Issues:
        - Assumes `first_name`, `last_name`, and `role` are present in `raw_user_meta_data`. If not, the insert will use defaults or potentially fail depending on `public.users` constraints.
        - The `company_id` is initially set to NULL.
        - **Requires that the `role` provided in `raw_user_meta_data` during user creation is a valid *lowercase* value from the `user_role` enum.**
    */

    -- Create or replace the function to handle new user creation
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER -- Allows the function to run with elevated privileges
    SET search_path = public
    AS $$
    DECLARE
      user_role user_role;
      first_name text;
      last_name text;
      provided_role text;
    BEGIN
      -- Extract role text from metadata
      provided_role := lower(NEW.raw_user_meta_data->>'role'); -- Ensure lowercase comparison

      -- Validate and cast the role
      BEGIN
        IF provided_role IS NULL THEN
          RAISE WARNING 'Role not provided in user metadata for user %. Setting role to default ''company_user''.', NEW.id;
          user_role := 'company_user'; -- Default role if metadata is missing
        ELSE
          user_role := provided_role::user_role; -- Attempt to cast to enum
        END IF;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE WARNING 'Invalid role value "%" provided in user metadata for user %. Setting role to default ''company_user''.', provided_role, NEW.id;
        user_role := 'company_user'; -- Fallback role if casting fails
      END;

      -- Extract other metadata, providing defaults if missing
      first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', ' ');
      last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', ' ');

      -- Insert into public.users
      INSERT INTO public.users (id, email, first_name, last_name, role, company_id, is_active, license_consumed)
      VALUES (
        NEW.id,
        NEW.email,
        first_name,
        last_name,
        user_role, -- Use the validated/defaulted role
        NULL,
        true,
        false
      )
      ON CONFLICT (id) DO NOTHING; -- Avoid error if user somehow already exists in public.users

      RAISE LOG 'Handled new user: % with role: %', NEW.id, user_role;

      RETURN NEW;
    END;
    $$;

    -- Drop the trigger IF EXISTS first to ensure it uses the latest function definition
    -- This is safer than relying solely on CREATE OR REPLACE FUNCTION if the trigger logic itself needed changes (though it doesn't here)
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

    -- Create the trigger to execute the function after user creation in auth.users
    -- Using standard CREATE TRIGGER as we dropped it above.
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

    RAISE LOG 'handle_new_user function updated and on_auth_user_created trigger ensured.';
