/*
      # Fix RLS Recursion on Companies Table

      This migration addresses the `42P17` infinite recursion error encountered when querying the `users` table with a join to the `companies` table. The recursion occurs because RLS policies on `companies` (for Company Admins, Company Users, and Reseller Admins) previously needed to query the `users` or `resellers` table to verify relationships, creating a loop.

      **Changes:**

      1.  **New Function:**
          *   `get_my_reseller_id_for_admin()`: A `SECURITY DEFINER` function that safely retrieves the `id` of the reseller managed by the currently authenticated user (if they are a Reseller Admin), without causing recursion.

      2.  **Modified RLS Policies on `companies`:**
          *   Dropped the existing policies for CA SELECT/UPDATE, CU SELECT, and RA SELECT/UPDATE.
          *   Recreated these policies using `get_my_claim('role')` combined with the `SECURITY DEFINER` functions `get_my_company_id()` (existing) and `get_my_reseller_id_for_admin()` (new) to break the recursive dependency on the `users` and `resellers` tables.
          *   The `COMP: Allow CU SELECT on own company` policy now explicitly checks for the `company_user` role for added clarity and security.

      **Goal:** Eliminate the RLS recursion error when joining `companies` from `users`.
    */

    -- 1. Create the new SECURITY DEFINER function for Reseller Admins
    CREATE OR REPLACE FUNCTION public.get_my_reseller_id_for_admin()
    RETURNS uuid
    LANGUAGE sql
    SECURITY DEFINER
    -- Set a secure search_path: IMPORTANT to prevent search_path attacks
    SET search_path = public
    AS $$
      SELECT id
      FROM public.resellers
      WHERE admin_user_id = auth.uid();
    $$;

    -- Revoke default execute permission and grant only to authenticated users
    REVOKE EXECUTE ON FUNCTION public.get_my_reseller_id_for_admin() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.get_my_reseller_id_for_admin() TO authenticated;


    -- 2. Drop the potentially recursive policies on 'companies'
    DROP POLICY IF EXISTS "COMP: Allow CA SELECT on own company" ON public.companies;
    DROP POLICY IF EXISTS "COMP: Allow CA UPDATE on own company" ON public.companies;
    DROP POLICY IF EXISTS "COMP: Allow RA SELECT on managed companies" ON public.companies;
    DROP POLICY IF EXISTS "COMP: Allow RA UPDATE on managed companies" ON public.companies;
    DROP POLICY IF EXISTS "COMP: Allow CU SELECT on own company" ON public.companies;


    -- 3. Recreate policies using SECURITY DEFINER functions and get_my_claim

    -- Policy: Allow Company Admins SELECT on their own company (using functions)
    CREATE POLICY "COMP: Allow CA SELECT on own company"
      ON public.companies FOR SELECT
      USING (
        (get_my_claim('role'::text) = 'company_admin'::text) AND
        (public.get_my_company_id() = companies.id) -- Use function
      );

    -- Policy: Allow Company Admins UPDATE on their own company (using functions)
    CREATE POLICY "COMP: Allow CA UPDATE on own company"
      ON public.companies FOR UPDATE
      USING (
        (get_my_claim('role'::text) = 'company_admin'::text) AND
        (public.get_my_company_id() = companies.id) -- Use function
      )
      WITH CHECK (
        (get_my_claim('role'::text) = 'company_admin'::text) AND
        (public.get_my_company_id() = companies.id) -- Use function
      );

    -- Policy: Allow Reseller Admins SELECT on companies they manage (using functions)
    CREATE POLICY "COMP: Allow RA SELECT on managed companies"
      ON public.companies FOR SELECT
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text) AND
        (public.get_my_reseller_id_for_admin() = companies.reseller_id) -- Use function
      );

    -- Policy: Allow Reseller Admins UPDATE on companies they manage (using functions)
    CREATE POLICY "COMP: Allow RA UPDATE on managed companies"
      ON public.companies FOR UPDATE
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text) AND
        (public.get_my_reseller_id_for_admin() = companies.reseller_id) -- Use function
      )
      WITH CHECK (
        (get_my_claim('role'::text) = 'reseller_admin'::text) AND
        (public.get_my_reseller_id_for_admin() = companies.reseller_id) -- Use function
      );

    -- Policy: Allow Company Users SELECT on their own company (using functions + role check)
    CREATE POLICY "COMP: Allow CU SELECT on own company"
      ON public.companies FOR SELECT
      USING (
         (get_my_claim('role'::text) = 'company_user'::text) AND -- Explicit role check
         (public.get_my_company_id() = companies.id) -- Use function
      );