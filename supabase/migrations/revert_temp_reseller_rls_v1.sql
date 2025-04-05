```sql
    /*
      # Revert Temporary Reseller RLS and Restore Policies (v1)

      **PURPOSE:** This migration reverts the temporary permissive RLS policy
      on the `resellers` table and restores the intended, secure RLS policies.

      **BACKGROUND:** A temporary policy (`TEMP_DEBUG: Allow any authenticated user SELECT`)
      was applied to diagnose a join issue for Reseller Admins in `/api/profile/me`.
      That test confirmed the issue lies within the RLS SELECT policy logic for
      Reseller Admins on the `resellers` table.

      **ACTION:**
      1. Drop the temporary permissive SELECT policy.
      2. Restore the simplified Reseller Admin SELECT policy (checks `admin_user_id`).
      3. Restore the Reseller Admin UPDATE policy.
      4. Restore the Global Admin full access policy.
      5. Restore the Company Member SELECT policy.

      **NEXT STEPS:** After applying this, the Reseller Admin join in `/api/profile/me`
      is expected to fail again. Further investigation is needed into *why* the
      `USING (admin_user_id = auth.uid())` clause fails during the join context.
    */

    -- 1. Drop the temporary policy
    DROP POLICY IF EXISTS "TEMP_DEBUG: Allow any authenticated user SELECT" ON public.resellers;

    -- 2. Restore simplified Reseller Admin SELECT policy
    CREATE POLICY "RESL: Allow RA SELECT on own reseller record (simplified)"
      ON public.resellers FOR SELECT
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text)
        AND
        admin_user_id = auth.uid()
      );

    -- 3. Restore Reseller Admin UPDATE policy
    CREATE POLICY "RESL: Allow RA UPDATE on own reseller record"
      ON public.resellers FOR UPDATE
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text)
        AND
        admin_user_id = auth.uid()
      )
      WITH CHECK (
         (get_my_claim('role'::text) = 'reseller_admin'::text)
         AND
         admin_user_id = auth.uid()
      );

    -- 4. Restore Global Admin full access policy
    CREATE POLICY "RESL: Allow Global Admin full access"
      ON public.resellers FOR ALL -- SELECT, INSERT, UPDATE, DELETE
      USING (
        get_my_claim('role'::text) = 'global_admin'::text
      )
      WITH CHECK (
        get_my_claim('role'::text) = 'global_admin'::text
      );

    -- 5. Restore Company Member SELECT policy (CA/CU)
    CREATE POLICY "RESL: Allow Company members SELECT on linked reseller"
      ON public.resellers FOR SELECT
      USING (
        (
          -- User must be Company Admin or Company User
          (get_my_claim('role'::text) = 'company_admin'::text) OR (get_my_claim('role'::text) = 'company_user'::text)
        )
        AND
        -- The reseller's ID must match the ID of the reseller linked to the user's company
        id = (
          SELECT c.reseller_id
          FROM public.companies c
          WHERE c.id = get_my_user_company_id() -- Use function to get user's company_id
        )
      );
    ```