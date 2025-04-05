/*
      # Simplify Reseller Admin SELECT RLS Policy (v1 - Debugging)

      This migration simplifies the SELECT RLS policy for Reseller Admins on the `resellers` table as a debugging step.

      **Problem:** The `/api/profile/me` endpoint fails to return the joined `reseller` object for Reseller Admins, even after applying the `refine_join_select_rls_v1.sql` migration.

      **Hypothesis:** The subquery `(SELECT u.reseller_id FROM public.users u WHERE u.id = auth.uid())` within the previous policy might be failing due to RLS context issues when evaluated during the join from `users` to `resellers`.

      **Change:**
      - Replaced the `RESL: Allow RA SELECT on own reseller record` policy with a simpler version that *only* checks if the `resellers.admin_user_id` matches the current user's `auth.uid()`. The check based on `users.reseller_id` is temporarily removed.

      **Goal:** Determine if removing the subquery allows the join to succeed. If it does, the issue lies with the subquery execution within the RLS policy context. If it still fails, the problem is likely elsewhere.
    */

    -- Drop the previous potentially problematic policy
    DROP POLICY IF EXISTS "RESL: Allow RA SELECT on own reseller record" ON public.resellers;

    -- Create a simplified SELECT policy for Reseller Admins (using only admin_user_id)
    CREATE POLICY "RESL: Allow RA SELECT on own reseller record (simplified)"
      ON public.resellers FOR SELECT
      USING (
        -- User must be a Reseller Admin
        (get_my_claim('role'::text) = 'reseller_admin'::text)
        AND
        -- Allow select ONLY if the reseller's admin_user_id matches the logged-in user
        admin_user_id = auth.uid()
      );