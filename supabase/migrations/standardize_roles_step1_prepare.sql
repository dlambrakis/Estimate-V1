/*
      # Standardize User Roles - Step 1: Prepare New Enum and Column

      This is the first step in standardizing the `user_role` enum to lowercase.
      Direct renaming of enum values failed, so this migration adopts a safer, multi-step approach.

      1. New Enum Type:
         - Creates a new enum type `user_role_new` with lowercase values:
           - `global_admin`
           - `reseller_admin`
           - `company_admin`
           - `company_user`

      2. New Column:
         - Adds a new column `role_new` to the `public.users` table, typed with `user_role_new`.

      3. Data Population:
         - Updates the `role_new` column based on the existing `role` column, mapping the old CamelCase values to the new lowercase enum values.

      4. Next Steps:
         - The next migration (`standardize_roles_step2_finalize.sql`) will drop the old column/enum and rename the new ones.
    */

    -- 1. Create the new enum type with lowercase values
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_new' AND typtype = 'e' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        RAISE NOTICE 'Creating enum type public.user_role_new';
        CREATE TYPE public.user_role_new AS ENUM (
          'global_admin',
          'reseller_admin',
          'company_admin',
          'company_user'
        );
        RAISE NOTICE 'Successfully created enum type public.user_role_new';
      ELSE
        RAISE NOTICE 'Enum type public.user_role_new already exists, skipping creation.';
      END IF;
    END $$;

    -- 2. Add the new column to the users table
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role_new'
      ) THEN
        RAISE NOTICE 'Adding column role_new to public.users';
        ALTER TABLE public.users ADD COLUMN role_new public.user_role_new;
        RAISE NOTICE 'Successfully added column role_new';
      ELSE
        RAISE NOTICE 'Column role_new already exists on public.users, skipping add.';
      END IF;
    END $$;

    -- 3. Populate the new column based on the old column's values
    RAISE NOTICE 'Attempting to populate role_new based on existing role column...';
    UPDATE public.users
    SET role_new = CASE
      WHEN role::text = 'GlobalAdmin' THEN 'global_admin'::public.user_role_new
      WHEN role::text = 'ResellerAdmin' THEN 'reseller_admin'::public.user_role_new
      WHEN role::text = 'CompanyAdmin' THEN 'company_admin'::public.user_role_new
      WHEN role::text = 'CompanyUser' THEN 'company_user'::public.user_role_new
      ELSE NULL -- Or handle unexpected values appropriately
    END
    WHERE role_new IS NULL; -- Only update rows where the new column hasn't been populated yet
    RAISE NOTICE 'Finished populating role_new.';