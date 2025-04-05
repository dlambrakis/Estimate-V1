/*
      # Standardize User Role Enum to Lowercase

      This migration updates the `user_role` enum to use lowercase values for consistency across the application, particularly for JWT claims and RLS checks.

      1. Changes:
        - Rename existing enum values ('GlobalAdmin', 'ResellerAdmin', 'CompanyAdmin', 'CompanyUser') to their lowercase equivalents ('global_admin', 'reseller_admin', 'company_admin', 'company_user').

      2. Important Notes:
        - This change requires subsequent updates to any data relying on the old casing (handled in the next migration).
        - RLS policies and application code referencing these roles might need updating if they hardcoded the CamelCase values. (Our RLS helpers use `get_my_claim('role')` which should adapt if the JWT claim becomes lowercase).
    */

    -- Rename enum values to lowercase
    -- Note: Renaming enum values needs to be done carefully.
    -- Supabase/Postgres doesn't have a direct ALTER TYPE ... RENAME VALUE IF EXISTS.
    -- We'll rename them one by one. If any fail (e.g., already renamed), the transaction should handle it.
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'GlobalAdmin' AND enumtypid = 'public.user_role'::regtype) THEN
        ALTER TYPE public.user_role RENAME VALUE 'GlobalAdmin' TO 'global_admin';
      END IF;
      IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ResellerAdmin' AND enumtypid = 'public.user_role'::regtype) THEN
        ALTER TYPE public.user_role RENAME VALUE 'ResellerAdmin' TO 'reseller_admin';
      END IF;
      IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CompanyAdmin' AND enumtypid = 'public.user_role'::regtype) THEN
        ALTER TYPE public.user_role RENAME VALUE 'CompanyAdmin' TO 'company_admin';
      END IF;
      IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CompanyUser' AND enumtypid = 'public.user_role'::regtype) THEN
        ALTER TYPE public.user_role RENAME VALUE 'CompanyUser' TO 'company_user';
      END IF;
    END $$;
