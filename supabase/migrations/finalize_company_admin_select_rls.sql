```sql
/*
  # Finalize Company Admin SELECT RLS Policy

  This migration reverts the temporary debugging RLS policy and applies the
  final, secure policy for Company Admins selecting their own company details
  from the `public.companies` table.

  1.  **Problem:**
      Testing revealed that including `get_my_claim('role'::text)` in the RLS
      policy's `USING` clause caused it to fail for the `/api/companies/my-company`
      endpoint query, resulting in 404 errors. A policy relying solely on
      `companies.admin_user_id = auth.uid()` worked correctly.

  2.  **Solution:**
      - Drop the temporary debugging policy (`TEMP_DEBUG: Allow SELECT if admin_user_id matches auth.uid`).
      - Re-create the `"COMP: Allow CA SELECT on own company"` policy using *only* the direct check `(companies.admin_user_id = auth.uid())`. This is secure in this context as it uniquely identifies the admin's own company row.
      - The corresponding UPDATE policy (`"COMP: Allow CA UPDATE on own company"`) retains the role check for added safety during direct update operations.

  3.  **Modified Policies:**
      - Dropped `"TEMP_DEBUG: Allow SELECT if admin_user_id matches auth.uid"`.
      - Recreated `"COMP: Allow CA SELECT on own company"` using `(companies.admin_user_id = auth.uid())`.
      - Ensured `"COMP: Allow CA UPDATE on own company"` exists with the role check + admin_user_id check.
*/

-- Drop the temporary debugging policy
DROP POLICY IF EXISTS "TEMP_DEBUG: Allow SELECT if admin_user_id matches auth.uid" ON public.companies;

-- Drop the target policy IF EXISTS before creating, just in case
DROP POLICY IF EXISTS "COMP: Allow CA SELECT on own company" ON public.companies;

-- Recreate the SELECT policy using ONLY the direct admin_user_id check
CREATE POLICY "COMP: Allow CA SELECT on own company"
  ON public.companies FOR SELECT
  USING (
    (companies.admin_user_id = auth.uid()) -- Check ONLY if the company's admin is the current user
  );

-- Ensure the UPDATE policy exists and uses the role check + direct admin_user_id check
-- Drop first for idempotency
DROP POLICY IF EXISTS "COMP: Allow CA UPDATE on own company" ON public.companies;
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