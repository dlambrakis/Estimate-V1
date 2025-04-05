/*
      # Fix Reseller RLS Recursion

      This migration corrects the Row Level Security (RLS) policies for Reseller Admins (RA) on the `public.resellers` table to prevent infinite recursion errors (`42P17`).

      **Problem:**
      The previous policies `"RESL: Allow RA SELECT on own reseller record"` and `"RESL: Allow RA UPDATE on own reseller record"` used an `EXISTS` clause with a subquery on the `resellers` table itself (`SELECT 1 FROM resellers r WHERE ...`). This caused Supabase to re-evaluate the same RLS policy when processing the subquery, leading to infinite recursion.

      **Solution:**
      The policies are updated to directly compare the `admin_user_id` column of the `resellers` row being accessed with the authenticated user's ID (`auth.uid()`). This removes the recursive subquery.

      **Changes:**

      1.  **Policies Dropped:**
          *   `"RESL: Allow RA SELECT on own reseller record"`
          *   `"RESL: Allow RA UPDATE on own reseller record"`
      2.  **Policies Recreated:**
          *   `"RESL: Allow RA SELECT on own reseller record"`: Recreated with `USING ((get_my_claim('role'::text) = 'reseller_admin'::text) AND (resellers.admin_user_id = auth.uid()))`.
          *   `"RESL: Allow RA UPDATE on own reseller record"`: Recreated with the same direct check in both `USING` and `WITH CHECK` clauses.
    */

    -- Drop the problematic policies first
    DROP POLICY IF EXISTS "RESL: Allow RA SELECT on own reseller record" ON public.resellers;
    DROP POLICY IF EXISTS "RESL: Allow RA UPDATE on own reseller record" ON public.resellers;

    -- Recreate the SELECT policy with the direct check
    CREATE POLICY "RESL: Allow RA SELECT on own reseller record"
      ON public.resellers FOR SELECT
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text) AND
        (resellers.admin_user_id = auth.uid()) -- Direct check, no subquery
      );

    -- Recreate the UPDATE policy with the direct check
    CREATE POLICY "RESL: Allow RA UPDATE on own reseller record"
      ON public.resellers FOR UPDATE
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text) AND
        (resellers.admin_user_id = auth.uid()) -- Direct check
      )
      WITH CHECK (
        (get_my_claim('role'::text) = 'reseller_admin'::text) AND
        (resellers.admin_user_id = auth.uid()) -- Direct check
      );
