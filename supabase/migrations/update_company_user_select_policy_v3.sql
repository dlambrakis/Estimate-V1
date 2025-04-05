/*
          # Update Company User SELECT Policy on Companies v3

          This migration updates the RLS policy allowing Company Users to select data
          from the `companies` table. This version ensures the policy is dropped safely
          before recreation and explicitly casts the role claim for comparison.

          1.  **Changes:**
              *   Dropped the existing `COMP: Allow CU SELECT on own company` policy using `IF EXISTS`.
              *   Recreated the policy using the `get_my_user_company_id()` function.
              *   The policy now checks if the user's role is `company_user` (using `get_my_claim` cast to text) AND if the `companies.id` matches the result of `get_my_user_company_id()` (the user's own company ID from the `users` table).
              *   Removed RAISE LOG statement due to SQL Editor syntax error (42601).

          2.  **Reasoning:**
              *   The previous policy incorrectly used `get_my_company_id()`, which is intended for Company Admins (checking `companies.admin_user_id`).
              *   This version correctly grants access based on the `company_id` stored in the `users` table for the specific Company User.
              *   Using `DROP POLICY IF EXISTS` makes the migration more robust.
              *   Explicitly casting `get_my_claim` ensures type safety in comparison.
        */

        -- Drop the old policy IF IT EXISTS to avoid errors if it was already dropped or never created
        DROP POLICY IF EXISTS "COMP: Allow CU SELECT on own company" ON public.companies;

        -- Recreate policy using the correct function for company users
        CREATE POLICY "COMP: Allow CU SELECT on own company"
          ON public.companies FOR SELECT
          USING (
             (get_my_claim('role'::text)::text = 'company_user'::text) AND -- Ensure claim comparison is text vs text
             (public.get_my_user_company_id() = companies.id) -- Use function that checks users.company_id
          );
