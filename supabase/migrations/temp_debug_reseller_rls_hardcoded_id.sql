/*
      # TEMP DEBUG: Reseller RLS Policy (Hardcoded admin_user_id Check)

      **PURPOSE:** Temporarily replaces the Reseller Admin SELECT RLS policy on `public.resellers`
      with a version that hardcodes the known Reseller Admin user ID (`e4de40d4-b100-47b8-b326-c8c22b238ba7`)
      for the `admin_user_id` check. This removes the `public.get_my_auth_uid()` function call
      to isolate whether the RLS evaluation itself is failing even with correct, directly compared data.

      **BACKGROUND:** The previous policy using `resellers.admin_user_id = public.get_my_auth_uid()`
      failed to grant access, even though direct SQL queries confirmed the data linkage is correct
      and the function works. This points to a potential issue within the RLS evaluation context
      when using the function for this specific table/policy.

      **ACTION:**
      1. Drop the existing Reseller Admin SELECT policy ("RESL: Allow RA SELECT on own reseller record (simplified)").
      2. Create a *temporary debugging* Reseller Admin SELECT policy ("TEMP_DEBUG: Allow RA SELECT via hardcoded admin_user_id")
         that uses the check: `resellers.admin_user_id = 'e4de40d4-b100-47b8-b326-c8c22b238ba7'::uuid`.

      **EXPECTATION:** If the Reseller Admin profile fetch *succeeds* with this policy,
      it confirms the issue lies with the interaction between the RLS policy and the
      `public.get_my_auth_uid()` function call in this context. If it *still fails*,
      there's a deeper RLS issue on the `resellers` table.

      **NOTE:** This policy is for debugging ONLY and MUST be reverted later.
    */

    -- Drop existing RA SELECT policy first (using IF EXISTS for idempotency)
    DROP POLICY IF EXISTS "RESL: Allow RA SELECT on own reseller record (simplified)" ON public.resellers;

    -- Drop the target policy IF EXISTS before creating, just in case
    DROP POLICY IF EXISTS "TEMP_DEBUG: Allow RA SELECT via hardcoded admin_user_id" ON public.resellers;

    -- 1. Create Temporary Debug Reseller Admin SELECT policy (Hardcoded admin_user_id Check)
    CREATE POLICY "TEMP_DEBUG: Allow RA SELECT via hardcoded admin_user_id"
      ON public.resellers FOR SELECT
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text)
        AND
        -- Check: The reseller record's admin_user_id must match the HARDCODED Reseller Admin user ID
        resellers.admin_user_id = 'e4de40d4-b100-47b8-b326-c8c22b238ba7'::uuid
      );

    -- Note: Other policies (Global Admin, service_role, UPDATE) remain unchanged.
