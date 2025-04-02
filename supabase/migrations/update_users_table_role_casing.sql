/*
      # Update public.users Role Column to Lowercase

      This migration updates the `role` column in the `public.users` table to use the new lowercase enum values defined in the `user_role` type, ensuring data consistency.

      1. Changes:
        - Updates existing rows in `public.users` to convert CamelCase role values to their lowercase equivalents.

      2. Dependencies:
        - This migration assumes the `standardize_user_role_enum.sql` migration has been applied, renaming the enum values.
    */

    -- Update existing data in public.users table
    UPDATE public.users
    SET role = CASE
      WHEN role::text = 'GlobalAdmin' THEN 'global_admin'::user_role
      WHEN role::text = 'ResellerAdmin' THEN 'reseller_admin'::user_role
      WHEN role::text = 'CompanyAdmin' THEN 'company_admin'::user_role
      WHEN role::text = 'CompanyUser' THEN 'company_user'::user_role
      ELSE role -- Keep existing value if it's already lowercase or unexpected
    END
    WHERE role::text IN ('GlobalAdmin', 'ResellerAdmin', 'CompanyAdmin', 'CompanyUser'); -- Only update rows with old casing