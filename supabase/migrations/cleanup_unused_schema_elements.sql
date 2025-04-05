/*
      # Schema Cleanup (Based on Code Analysis)

      This migration removes database elements that appear unused or redundant
      based on analysis of the current backend services and routes
      (authService, companyService, licenseService, profileRoutes).

      1. Dropped Table
         - `global_admin_profiles`: This table does not appear to be referenced
           or used by the analyzed backend code.

      2. Dropped Column
         - `company_licenses.expires_at`: This column seems redundant with
           `company_licenses.end_date` and is not explicitly used in the
           analyzed license service logic.

      3. Potentially Unused Columns (NOT Dropped)
         - `users.reseller_id`: Purpose unclear from analyzed code. Retained for
           potential use elsewhere or future features. Requires further investigation.
         - `companies.admin_user_id`: Purpose unclear from analyzed code. Retained
           for potential use elsewhere or future features. Requires further investigation.

      4. Security
         - No direct changes to RLS policies are made by this migration, but
           dropping tables/columns might implicitly affect policies referencing them
           (though none were identified for the dropped elements).

      IMPORTANT: This cleanup is based SOLELY on the provided code context.
      Thorough testing is required after applying this migration. The potentially
      unused columns should be investigated further before considering removal.
    */

    -- Drop the apparently unused global_admin_profiles table
    DROP TABLE IF EXISTS public.global_admin_profiles;

    -- Drop the apparently redundant expires_at column from company_licenses
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'company_licenses'
          AND column_name = 'expires_at'
      ) THEN
        ALTER TABLE public.company_licenses DROP COLUMN expires_at;
        RAISE NOTICE 'Column company_licenses.expires_at dropped.';
      ELSE
        RAISE NOTICE 'Column company_licenses.expires_at does not exist, skipping drop.';
      END IF;
    END $$;

    -- Note: No SQL action is taken for users.reseller_id or companies.admin_user_id
    -- as they are being retained pending further investigation.
