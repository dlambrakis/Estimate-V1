```sql
    /*
      # Update Reseller RLS Policies (Original Logic + Function)

      **PURPOSE:** Restores the original logic for the Reseller Admin SELECT RLS policy
      on `public.resellers`, but modifies it to use the `public.get_my_auth_uid()` function.
      The original logic checked both `admin_user_id` and that the user's own `reseller_id`
      matched the target row's `id`.

      **BACKGROUND:** The simplified policy (checking only `admin_user_id = get_my_auth_uid()`)
      did not resolve the join issue in `/api/profile/me` even after the function was
      successfully created. This attempts the combined check using the reliable function.

      **ACTION:**
      1. Drop the existing simplified Reseller Admin SELECT policy.
      2. Drop the existing Reseller Admin UPDATE policy.
      3. Recreate the Reseller Admin SELECT policy using the original combined logic
         (checking `admin_user_id` AND `resellers.id` against the user's `reseller_id`)
         but replacing `auth.uid()` with `public.get_my_auth_uid()`.
      4. Recreate the Reseller Admin UPDATE policy using `public.get_my_auth_uid()`.

      **NOTE:** This assumes the `public.get_my_auth_uid()` function exists.
    */

    -- Drop existing RA policies first (using IF EXISTS for idempotency)
    DROP POLICY IF EXISTS "RESL: Allow RA SELECT on own reseller record (simplified)" ON public.resellers;
    DROP POLICY IF EXISTS "RESL: Allow RA UPDATE on own reseller record" ON public.resellers; -- Drop update policy too

    -- 1. Recreate Reseller Admin SELECT policy (Original Logic + Function)
    CREATE POLICY "RESL: Allow RA SELECT on own reseller record"
      ON public.resellers FOR SELECT
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text)
        AND
        -- Check 1: The reseller record's admin must be the current user
        resellers.admin_user_id = public.get_my_auth_uid()
        AND
        -- Check 2: The reseller record's ID must match the user's reseller_id from the users table
        resellers.id = (SELECT u.reseller_id FROM public.users u WHERE u.id = public.get_my_auth_uid())
      );

    -- 2. Recreate Reseller Admin UPDATE policy using the function (Matches previous update policy)
    CREATE POLICY "RESL: Allow RA UPDATE on own reseller record"
      ON public.resellers FOR UPDATE
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text)
        AND
        admin_user_id = public.get_my_auth_uid() -- Use the function
      )
      WITH CHECK (
         (get_my_claim('role'::text) = 'reseller_admin'::text)
         AND
         admin_user_id = public.get_my_auth_uid() -- Use the function
      );
    ```