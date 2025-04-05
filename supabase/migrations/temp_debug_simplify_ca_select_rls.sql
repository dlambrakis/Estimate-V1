```sql
/*
  # TEMP DEBUG: Simplify Company Admin SELECT RLS Policy (Remove Role Check)

  This migration temporarily simplifies the Row Level Security (RLS) policy
  that allows Company Admins to select their own company details from the
  `public.companies` table, removing the role check for debugging purposes.

  1.  **Problem:**
      The `COMP: Allow CA SELECT on own company` policy, even when using the
      direct `admin_user_id = auth.uid()` check, is still resulting in a 404
      error, indicating the policy is failing.

  2.  **Debugging Step:**
      - Temporarily remove the `get_my_claim('role'::text) = 'company_admin'::text`
        condition from the policy.
      - The policy will now *only* check if `companies.admin_user_id = auth.uid()`.

  3.  **Goal:**
      - Determine if the `get_my_claim('role'::text)` part is causing the failure.
      - If this simplified policy works, the issue lies with the role claim check
        within the RLS context for this table/query.
      - If it still fails, the issue lies with the `admin_user_id = auth.uid()`
        comparison itself within the RLS context, or a deeper issue.

  4.  **Modified Policies:**
      - Dropped `"COMP: Allow CA SELECT on own company"`.
      - Created `"TEMP_DEBUG: Allow SELECT if admin_user_id matches auth.uid"` using only `(companies.admin_user_id = auth.uid())`.

  **CRITICAL:** This is a temporary, less secure policy for debugging only. It MUST be reverted.
*/

-- Drop the previous policy
DROP POLICY IF EXISTS "COMP: Allow CA SELECT on own company" ON public.companies;

-- Drop the temporary policy name if it exists from a previous attempt
DROP POLICY IF EXISTS "TEMP_DEBUG: Allow SELECT if admin_user_id matches auth.uid" ON public.companies;


-- Recreate the SELECT policy using ONLY the direct admin_user_id check
CREATE POLICY "TEMP_DEBUG: Allow SELECT if admin_user_id matches auth.uid"
  ON public.companies FOR SELECT
  USING (
    (companies.admin_user_id = auth.uid()) -- Check ONLY if the company's admin is the current user
  );

-- Note: The UPDATE policy "COMP: Allow CA UPDATE on own company" remains unchanged for now.

```