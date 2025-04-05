```sql
    /*
      # Update Reseller RLS Policies to Use get_my_auth_uid Function

      **PURPOSE:** Modifies the Reseller Admin SELECT and UPDATE RLS policies
      on the `public.resellers` table to use the new `public.get_my_auth_uid()`
      function instead of calling `auth.uid()` directly.

      **BACKGROUND:** This is an attempt to resolve the issue where the Reseller Admin
      join fails in `/api/profile/me`. Using a `SECURITY DEFINER` function for the
      UID check might alter the evaluation context during the join and allow the
      policy to pass correctly. The `get_my_auth_uid` function has now been successfully created.

      **ACTION:**
      1. Drop the existing simplified Reseller Admin SELECT policy.
      2. Drop the existing Reseller Admin UPDATE policy.
      3. Recreate the simplified Reseller Admin SELECT policy using `get_my_auth_uid()`.
      4. Recreate the Reseller Admin UPDATE policy using `get_my_auth_uid()`.

      **NOTE:** Other policies on `resellers` (Global Admin, Company Member SELECT) remain unchanged.
    */

    -- Drop existing RA policies first (using IF EXISTS for idempotency)
    DROP POLICY IF EXISTS "RESL: Allow RA SELECT on own reseller record (simplified)" ON public.resellers;
    DROP POLICY IF EXISTS "RESL: Allow RA UPDATE on own reseller record" ON public.resellers;

    -- 1. Recreate simplified Reseller Admin SELECT policy using the function
    CREATE POLICY "RESL: Allow RA SELECT on own reseller record (simplified)"
      ON public.resellers FOR SELECT
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text)
        AND
        admin_user_id = public.get_my_auth_uid() -- Use the new function
      );

    -- 2. Recreate Reseller Admin UPDATE policy using the function
    CREATE POLICY "RESL: Allow RA UPDATE on own reseller record"
      ON public.resellers FOR UPDATE
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text)
        AND
        admin_user_id = public.get_my_auth_uid() -- Use the new function
      )
      WITH CHECK (
         (get_my_claim('role'::text) = 'reseller_admin'::text)
         AND
         admin_user_id = public.get_my_auth_uid() -- Use the new function
      );
    ```