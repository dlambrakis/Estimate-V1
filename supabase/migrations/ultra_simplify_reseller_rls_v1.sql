/*
      # Ultra-Simplify Reseller RLS Policy (v1)

      **PURPOSE:** To further isolate the RLS failure for Reseller Admins on the `public.resellers` table during joins.
      This policy removes the role check entirely, relying solely on the direct comparison between
      the table's `admin_user_id` and the current user's `auth.uid()`.

      **BACKGROUND:** Previous tests showed that even policies where the `USING` clause condition
      (`admin_user_id = auth.uid()` or even a hardcoded ID) should logically be true,
      failed to allow the Reseller Admin to select their associated reseller record during
      the `/api/profile/me` join. Grants have been confirmed correct.

      **ACTION:**
      1. Drop the previous simplified Reseller Admin SELECT policy.
      2. Create an ultra-simplified policy named "TEMP: Allow SELECT if admin_user_id matches auth.uid()"
         that only checks `admin_user_id = auth.uid()`.

      **EXPECTATION:** If this *still* fails, it points to a fundamental issue with RLS evaluation
      on this table for this role during joins, potentially a Supabase/PostgREST edge case.
      If it *succeeds*, it suggests an issue with how `get_my_claim('role')` interacts
      within the RLS policy during the join.
    */

    -- 1. Drop the previous simplified policy
    DROP POLICY IF EXISTS "RESL: Allow RA SELECT on own reseller record (simplified)" ON public.resellers;

    -- 2. Create the ultra-simplified policy
    -- Drop first in case it exists from a previous attempt
    DROP POLICY IF EXISTS "TEMP: Allow SELECT if admin_user_id matches auth.uid()" ON public.resellers;
    CREATE POLICY "TEMP: Allow SELECT if admin_user_id matches auth.uid()"
      ON public.resellers FOR SELECT
      USING (
        admin_user_id = auth.uid() -- Only check the user ID match
      );

    -- Note: Other policies (Global Admin, service_role, UPDATE, Company Member SELECT) remain unchanged.
