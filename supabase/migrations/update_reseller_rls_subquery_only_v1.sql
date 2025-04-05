/*
      # Update Reseller RLS Policy (Subquery Check Only)

      **PURPOSE:** Isolates the subquery condition in the Reseller Admin SELECT RLS policy
      on `public.resellers`. This policy only checks if the target `resellers.id`
      matches the `reseller_id` stored in the `public.users` table for the
      currently authenticated user (retrieved via `public.get_my_auth_uid()`).

      **BACKGROUND:** Previous attempts combining `admin_user_id` checks and this
      subquery check (using `get_my_auth_uid()`) failed to resolve the join issue
      in `/api/profile/me`. This isolates the subquery condition to see if it alone
      is sufficient or problematic.

      **ACTION:**
      1. Drop the existing Reseller Admin SELECT policy ("RESL: Allow RA SELECT on own reseller record").
      2. Create a new Reseller Admin SELECT policy ("RESL: Allow RA SELECT via user profile reseller_id")
         that only uses the subquery check:
         `resellers.id = (SELECT u.reseller_id FROM public.users u WHERE u.id = public.get_my_auth_uid())`.
      3. The UPDATE policy ("RESL: Allow RA UPDATE on own reseller record") remains unchanged.

      **NOTE:** This assumes the `public.get_my_auth_uid()` function exists.
    */

    -- Drop existing RA SELECT policy first (using IF EXISTS for idempotency)
    DROP POLICY IF EXISTS "RESL: Allow RA SELECT on own reseller record" ON public.resellers;

    -- 1. Create Reseller Admin SELECT policy (Subquery Check Only)
    CREATE POLICY "RESL: Allow RA SELECT via user profile reseller_id"
      ON public.resellers FOR SELECT
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text)
        AND
        -- Check: The reseller record's ID must match the user's reseller_id from the users table
        resellers.id = (SELECT u.reseller_id FROM public.users u WHERE u.id = public.get_my_auth_uid())
      );

    -- Note: The UPDATE policy "RESL: Allow RA UPDATE on own reseller record" created in the
    -- previous step remains active and uses the admin_user_id check with the function.
    -- No changes needed for the UPDATE policy here.
