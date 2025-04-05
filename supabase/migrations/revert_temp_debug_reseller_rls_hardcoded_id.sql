```sql
    /*
      # Revert Temporary Debug Reseller RLS Policy (Hardcoded ID)

      **PURPOSE:** Removes the temporary debugging RLS policy (`TEMP_DEBUG: Allow RA SELECT via hardcoded admin_user_id`)
      from the `public.resellers` table and restores the intended simplified secure policy.

      **BACKGROUND:** The temporary policy with a hardcoded user ID was used to isolate
      RLS evaluation issues. Testing confirmed that even this policy failed to allow
      the Reseller Admin to access their record during the profile join, indicating
      a fundamental RLS problem on the table for this role.

      **ACTION:**
      1. Drop the temporary debugging Reseller Admin SELECT policy.
      2. Recreate the simplified Reseller Admin SELECT policy using `auth.uid()`.

      **NEXT STEPS:** After applying this, the Reseller Admin join in `/api/profile/me`
      is expected to fail again. The next step is to investigate table grants.
    */

    -- 1. Drop the temporary policy
    DROP POLICY IF EXISTS "TEMP_DEBUG: Allow RA SELECT via hardcoded admin_user_id" ON public.resellers;

    -- 2. Restore simplified Reseller Admin SELECT policy (using auth.uid())
    -- Drop first in case it somehow exists from a partial revert
    DROP POLICY IF EXISTS "RESL: Allow RA SELECT on own reseller record (simplified)" ON public.resellers;
    CREATE POLICY "RESL: Allow RA SELECT on own reseller record (simplified)"
      ON public.resellers FOR SELECT
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text)
        AND
        admin_user_id = auth.uid() -- Use auth.uid() directly
      );

    -- Note: Other policies (Global Admin, service_role, UPDATE, Company Member SELECT) remain unchanged.
    ```