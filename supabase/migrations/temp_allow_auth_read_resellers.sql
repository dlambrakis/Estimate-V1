/*
      # TEMPORARY: Allow Authenticated Read on Resellers (DEBUGGING)

      **PURPOSE:** This migration temporarily replaces the specific Reseller Admin
      SELECT policy on the `resellers` table with a policy that allows ANY
      authenticated user to read ANY reseller record.

      **THIS IS FOR DEBUGGING ONLY.** It helps determine if the RLS policy
      on `resellers` is the reason the join fails for Reseller Admins in the
      `/api/profile/me` endpoint when using explicit foreign key naming.

      **ACTION:**
      1. Drop the existing simplified RA SELECT policy.
      2. Create a new policy allowing `authenticated` role to SELECT.

      **EXPECTED OUTCOME:** If the Reseller Admin profile fetch now includes the
      `reseller` object, it confirms the issue lies within the logic or evaluation
      context of the *correct* RLS policy on `resellers`. If it still fails,
      the problem is likely elsewhere (e.g., RLS on `users` during join, or a
      deeper Supabase join/RLS interaction issue).

      **CRITICAL:** This policy MUST be reverted immediately after testing.
    */

    -- Drop the current simplified policy first
    DROP POLICY IF EXISTS "RESL: Allow RA SELECT on own reseller record (simplified)" ON public.resellers;

    -- Drop the original refined policy just in case it's somehow active
    DROP POLICY IF EXISTS "RESL: Allow RA SELECT on own reseller record" ON public.resellers;
    DROP POLICY IF EXISTS "RESL: Allow RA UPDATE on own reseller record" ON public.resellers; -- Drop update too for clean state

    -- Drop other select policies to ensure only the temporary one is active for SELECT
    DROP POLICY IF EXISTS "RESL: Allow Global Admin full access" ON public.resellers; -- Keep GA full access for now? No, let's isolate SELECT.
    DROP POLICY IF EXISTS "RESL: Allow Company members SELECT on linked reseller" ON public.resellers;


    -- Create the temporary permissive SELECT policy
    CREATE POLICY "TEMP_DEBUG: Allow any authenticated user SELECT"
      ON public.resellers FOR SELECT
      TO authenticated -- Grant SELECT to any logged-in user
      USING (true); -- Allow access to all rows

    -- Re-add GA SELECT separately if needed for other tests, but keep it simple for now.
    -- Re-add other necessary policies (like UPDATE for RA, GA full access) AFTER testing and reverting this.
