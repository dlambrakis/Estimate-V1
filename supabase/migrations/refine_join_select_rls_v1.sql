/*
      # Refine RLS SELECT Policies for Joins (v1)

      This migration refines the SELECT Row Level Security (RLS) policies on the `companies` and `resellers` tables. The goal is to explicitly allow the joins performed by the `/api/profile/me` endpoint to succeed for non-Global Admin roles.

      **Problem:** The `/api/profile/me` endpoint successfully fetches the user's own profile data (from `users`) but fails to return the joined `company` or `reseller` objects for Company Admins, Company Users, and Reseller Admins. This occurs even when the `company_id` and `reseller_id` foreign keys in the `users` table are correctly populated.

      **Hypothesis:** The existing SELECT RLS policies on `companies` and `resellers`, while potentially correct for direct queries on those tables, are not permissive enough when the SELECT is triggered implicitly via a join originating from the `users` table query.

      **Changes:**

      1.  **`companies` Table:**
          *   Replaced `COMP: Allow CU SELECT on own company` and `COMP: Allow CA SELECT on own company` with a single, more direct policy: `COMP: Allow CU/CA SELECT on own company`. This policy allows SELECT if the company's `id` matches the `company_id` associated with the currently authenticated user (`auth.uid()`) in the `users` table.

      2.  **`resellers` Table:**
          *   Replaced `RESL: Allow RA SELECT on own reseller record` with an updated policy. This policy allows SELECT if the user is a Reseller Admin AND *either* the reseller's `id` matches the `reseller_id` associated with the user in the `users` table *or* the reseller's `admin_user_id` matches the user's `auth.uid()`. This covers both linkage scenarios.

      **Note:** Other policies (INSERT, UPDATE, DELETE, Global Admin access, service_role access) on these tables remain unchanged from the `update_rls_policies_alignment_v2_syntax_fix.sql` migration.
    */

    -- ==== COMPANIES ====

    -- Drop the previous SELECT policies for Company Admin and Company User
    DROP POLICY IF EXISTS "COMP: Allow CA SELECT on own company" ON public.companies;
    DROP POLICY IF EXISTS "COMP: Allow CU SELECT on own company" ON public.companies;
    DROP POLICY IF EXISTS "COMP: Allow CU/CA SELECT on own company" ON public.companies; -- Drop new name just in case

    -- Create a unified SELECT policy for Company Admins and Company Users
    CREATE POLICY "COMP: Allow CU/CA SELECT on own company"
      ON public.companies FOR SELECT
      USING (
        -- Allow select if the company.id matches the company_id of the logged-in user
        id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      );

    -- ==== RESELLERS ====

    -- Drop the previous SELECT policy for Reseller Admin
    DROP POLICY IF EXISTS "RESL: Allow RA SELECT on own reseller record" ON public.resellers;

    -- Create a refined SELECT policy for Reseller Admins
    CREATE POLICY "RESL: Allow RA SELECT on own reseller record"
      ON public.resellers FOR SELECT
      USING (
        -- User must be a Reseller Admin
        (get_my_claim('role'::text) = 'reseller_admin'::text)
        AND
        (
          -- Allow select if the reseller.id matches the reseller_id of the logged-in user
          id = (SELECT u.reseller_id FROM public.users u WHERE u.id = auth.uid())
          -- OR allow select if the reseller's admin_user_id matches the logged-in user
          OR admin_user_id = auth.uid()
        )
      );
