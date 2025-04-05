```sql
    /*
      # Finalize Reseller Admin SELECT RLS Policy (v1)

      **PURPOSE:** To establish the final, secure RLS policy for Reseller Admins
      selecting their own record from the `public.resellers` table.

      **BACKGROUND:** Testing revealed that including a role check (e.g., `get_my_claim('role')`)
      in the RLS `USING` clause prevented the join in `/api/profile/me` from succeeding
      for Reseller Admins, even though grants were correct and the user ID matched.
      An ultra-simplified policy `USING (admin_user_id = auth.uid())` *did* work.

      **ACTION:**
      1. Drop the temporary ultra-simplified policy (`TEMP: Allow SELECT if admin_user_id matches auth.uid()`).
      2. Create the final policy named "RESL: Allow RA SELECT on own reseller record"
         that relies *only* on the `admin_user_id = auth.uid()` check. This is
         secure for this specific case as it uniquely identifies the admin's own record.

      **NOTE:** The UPDATE policy *still* includes the role check in both `USING` and `WITH CHECK`
      as a best practice, assuming updates might not occur within the same problematic join context.
      Other policies (Global Admin, Company Member SELECT) remain unchanged.
    */

    -- 1. Drop the temporary policy
    DROP POLICY IF EXISTS "TEMP: Allow SELECT if admin_user_id matches auth.uid()" ON public.resellers;

    -- 2. Create the final Reseller Admin SELECT policy (without role check)
    -- Drop first for idempotency, in case it exists from a previous state
    DROP POLICY IF EXISTS "RESL: Allow RA SELECT on own reseller record" ON public.resellers;
    CREATE POLICY "RESL: Allow RA SELECT on own reseller record"
      ON public.resellers FOR SELECT
      USING (
        admin_user_id = auth.uid() -- Rely solely on the user ID match
      );

    -- Re-assert other essential policies to ensure they are present

    -- Reseller Admin UPDATE policy (KEEP role check here for safety during direct updates)
    DROP POLICY IF EXISTS "RESL: Allow RA UPDATE on own reseller record" ON public.resellers;
    CREATE POLICY "RESL: Allow RA UPDATE on own reseller record"
      ON public.resellers FOR UPDATE
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text) -- Keep role check for direct UPDATE
        AND
        admin_user_id = auth.uid()
      )
      WITH CHECK (
         (get_my_claim('role'::text) = 'reseller_admin'::text) -- Keep role check for direct UPDATE
         AND
         admin_user_id = auth.uid()
      );

    -- Global Admin full access policy
    DROP POLICY IF EXISTS "RESL: Allow Global Admin full access" ON public.resellers;
    CREATE POLICY "RESL: Allow Global Admin full access"
      ON public.resellers FOR ALL
      USING (
        get_my_claim('role'::text) = 'global_admin'::text
      )
      WITH CHECK (
        get_my_claim('role'::text) = 'global_admin'::text
      );

    -- Company Member SELECT policy (CA/CU)
    DROP POLICY IF EXISTS "RESL: Allow Company members SELECT on linked reseller" ON public.resellers;
    CREATE POLICY "RESL: Allow Company members SELECT on linked reseller"
      ON public.resellers FOR SELECT
      USING (
        (
          (get_my_claim('role'::text) = 'company_admin'::text) OR (get_my_claim('role'::text) = 'company_user'::text)
        )
        AND
        id = (
          SELECT c.reseller_id
          FROM public.companies c
          WHERE c.id = get_my_user_company_id() -- Use function
        )
      );
    ```