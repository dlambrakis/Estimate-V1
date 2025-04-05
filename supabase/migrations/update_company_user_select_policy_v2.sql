/*
          # Update Company User SELECT Policy on Companies v2

          This migration updates the RLS policy allowing Company Users to select data
          from the `companies` table.

          1.  **Changes:**
              *   Dropped the existing `COMP: Allow CU SELECT on own company` policy.
              *   Recreated the policy using the new `get_my_user_company_id()` function.
              *   The policy now checks if the user's role is `company_user` (using `get_my_claim`) AND if the `companies.id` matches the result of `get_my_user_company_id()` (the user's own company ID from the `users` table).

          2.  **Reasoning:**
              *   The previous policy incorrectly used `get_my_company_id()`, which is intended for Company Admins (checking `companies.admin_user_id`).
              *   This version correctly grants access based on the `company_id` stored in the `users` table for the specific Company User.
        */

        -- Drop the old policy
        DROP POLICY IF EXISTS "COMP: Allow CU SELECT on own company" ON public.companies;

        -- Recreate policy using the correct function for company users
        CREATE POLICY "COMP: Allow CU SELECT on own company"
          ON public.companies FOR SELECT
          USING (
             (get_my_claim('role'::text) = 'company_user'::text) AND
             (public.get_my_user_company_id() = companies.id) -- Use function that checks users.company_id
          );

        RAISE LOG 'Policy COMP: Allow CU SELECT on own company updated to use get_my_user_company_id().';
