```sql
/*
  # Fix Company Admin SELECT RLS Policy

  This migration updates the Row Level Security (RLS) policy that allows
  Company Admins to select their own company details from the `public.companies` table.

  1.  **Problem:**
      The previous policy used an `EXISTS` subquery on the `public.users` table
      to verify the user's company association. This subquery appears to be
      failing during RLS evaluation when the main query targets the `companies`
      table directly, leading to 404 errors even when the data exists.

  2.  **Solution:**
      - The policy is updated to directly compare the `admin_user_id` column
        of the `companies` row being accessed with the authenticated user's ID
        (`auth.uid()`). This leverages the direct link established between the
        company and its designated admin user.
      - The corresponding UPDATE policy is also updated for consistency.

  3.  **Modified Policies:**
      - Dropped `"COMP: Allow CA SELECT on own company"`.
      - Dropped `"COMP: Allow CA UPDATE on own company"`.
      - Recreated `"COMP: Allow CA SELECT on own company"` using `(get_my_claim('role'::text) = 'company_admin'::text) AND (companies.admin_user_id = auth.uid())`.
      - Recreated `"COMP: Allow CA UPDATE on own company"` using the same direct check in both `USING` and `WITH CHECK` clauses.
*/

-- Drop the previous policies that used the subquery
DROP POLICY IF EXISTS "COMP: Allow CA SELECT on own company" ON public.companies;
DROP POLICY IF EXISTS "COMP: Allow CA UPDATE on own company" ON public.companies;

-- Recreate the SELECT policy using the direct admin_user_id check
CREATE POLICY "COMP: Allow CA SELECT on own company"
  ON public.companies FOR SELECT
  USING (
    (get_my_claim('role'::text) = 'company_admin'::text) AND
    (companies.admin_user_id = auth.uid()) -- Check if the company's admin is the current user
  );

-- Recreate the UPDATE policy using the direct admin_user_id check
CREATE POLICY "COMP: Allow CA UPDATE on own company"
  ON public.companies FOR UPDATE
  USING (
    (get_my_claim('role'::text) = 'company_admin'::text) AND
    (companies.admin_user_id = auth.uid()) -- Check if the company's admin is the current user
  )
  WITH CHECK (
    (get_my_claim('role'::text) = 'company_admin'::text) AND
    (companies.admin_user_id = auth.uid()) -- Ensure they don't change it to someone else's company
  );

```