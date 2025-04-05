/*
      # Database Function Alignment and Cleanup

      This migration aligns database functions with the current schema, RLS policies, and application logic.

      1.  **Removed Functions:**
          *   `public.test_simple_function()`: Removed as it was a test function with a hardcoded return value and served no application purpose.
          *   `public.get_my_reseller_id()`: Removed because it incorrectly relied on a potentially obsolete `users.reseller_id` column and did not align with the RLS logic for identifying Reseller Admins (which uses `resellers.admin_user_id`).

      2.  **New Functions:**
          *   `public.get_my_managed_reseller_id()`: Created to correctly retrieve the `id` of the `resellers` record managed by the currently authenticated user, if they are a Reseller Admin (identified via `resellers.admin_user_id = auth.uid()`). Returns `NULL` if the user is not a Reseller Admin managing a reseller or if not authenticated.

      3.  **Retained Functions:**
          *   `auth.*`: Standard Supabase functions, left untouched.
          *   `pgbouncer.*`, `vault.*`: Infrastructure-related functions, left untouched.
          *   `public.get_my_claim()`: Essential for current RLS.
          *   `public.get_my_company_id()`: Aligned with schema, potentially useful.
          *   `public.get_my_role()`: Aligned with schema, potentially useful.
          *   `public.handle_new_user()`: Crucial trigger function for user profile creation.
          *   `public.trigger_set_timestamp()`: Standard utility trigger function.
    */

    -- Remove unused test function
    DROP FUNCTION IF EXISTS public.test_simple_function();

    -- Remove misaligned function relying on users.reseller_id
    DROP FUNCTION IF EXISTS public.get_my_reseller_id();

    -- Create new function to get the ID of the reseller managed by the current user (if RA)
    CREATE OR REPLACE FUNCTION public.get_my_managed_reseller_id()
    RETURNS uuid
    LANGUAGE plpgsql
    SECURITY DEFINER -- Use DEFINER to bypass RLS within the function if needed, but the query itself is safe
    -- SET search_path = public -- Uncomment if schema qualification is needed and not default
    AS $$
    DECLARE
      managed_reseller_id uuid;
    BEGIN
      -- Ensure the user is authenticated
      IF auth.uid() IS NULL THEN
        RETURN NULL;
      END IF;

      -- Find the reseller ID where the current user is the admin_user_id
      SELECT r.id INTO managed_reseller_id
      FROM public.resellers r
      WHERE r.admin_user_id = auth.uid()
      LIMIT 1; -- Ensure only one row is returned

      RETURN managed_reseller_id; -- Returns NULL if no matching reseller is found
    END;
    $$;

    -- Grant execute permission to authenticated users
    GRANT EXECUTE ON FUNCTION public.get_my_managed_reseller_id() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.get_my_managed_reseller_id() TO service_role;
