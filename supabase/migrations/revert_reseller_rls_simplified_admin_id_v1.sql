```sql
    /*
      # Revert Reseller RLS Policy (Simplified admin_user_id Check)

      **PURPOSE:** Reverts the Reseller Admin SELECT RLS policy on `public.resellers`
      back to the simplified version that only checks if the target `resellers.admin_user_id`
      matches the currently authenticated user's ID (retrieved via `public.get_my_auth_uid()`).

      **BACKGROUND:** Previous attempts using subqueries or combined logic failed.
      This policy represents the most direct link between the Reseller Admin user
      and their reseller record. We are reverting to this policy before testing
      a separate query approach in the API.

      **ACTION:**
      1. Drop the existing Reseller Admin SELECT policy ("RESL: Allow RA SELECT via user profile reseller_id").
      2. Create the Reseller Admin SELECT policy ("RESL: Allow RA SELECT on own reseller record (simplified)")
         that only uses the check: `resellers.admin_user_id = public.get_my_auth_uid()`.
      3. The UPDATE policy ("RESL: Allow RA UPDATE on own reseller record") remains unchanged.

      **NOTE:** This assumes the `public.get_my_auth_uid()` function exists and the
      `admin_user_id` column in `public.resellers` is correctly populated for the
      Reseller Admin user.
    */

    -- Drop existing RA SELECT policy first (using IF EXISTS for idempotency)
    DROP POLICY IF EXISTS "RESL: Allow RA SELECT via user profile reseller_id" ON public.resellers;

    -- Drop the target policy IF EXISTS before creating, just in case
    DROP POLICY IF EXISTS "RESL: Allow RA SELECT on own reseller record (simplified)" ON public.resellers;

    -- 1. Create Reseller Admin SELECT policy (Simplified admin_user_id Check Only)
    CREATE POLICY "RESL: Allow RA SELECT on own reseller record (simplified)"
      ON public.resellers FOR SELECT
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text)
        AND
        -- Check: The reseller record's admin_user_id must match the authenticated user's ID
        resellers.admin_user_id = public.get_my_auth_uid()
      );

    -- Note: The UPDATE policy "RESL: Allow RA UPDATE on own reseller record"
    -- created previously remains active.
    ```