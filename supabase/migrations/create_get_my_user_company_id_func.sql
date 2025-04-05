/*
          # Create get_my_user_company_id Function

          This migration creates a new SECURITY DEFINER function to safely retrieve the
          `company_id` associated with the currently authenticated user directly from the
          `public.users` table.

          1.  **New Function:**
              *   `get_my_user_company_id()`: Returns the `company_id` from the `public.users` table for the row where `id` matches `auth.uid()`. Uses `SECURITY DEFINER` to bypass RLS on the `users` table *only* for this lookup.

          2.  **Reasoning:**
              *   Needed for RLS policies where a user's access depends on their own `company_id` field (e.g., Company Users accessing their own company details).
              *   Avoids direct RLS-triggering subqueries on `public.users` within other policies.
        */
        CREATE OR REPLACE FUNCTION public.get_my_user_company_id()
        RETURNS uuid
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path = public
        AS $$
          SELECT company_id
          FROM public.users
          WHERE id = auth.uid()
          LIMIT 1;
        $$;

        -- Revoke default execute permission and grant only to authenticated users
        REVOKE EXECUTE ON FUNCTION public.get_my_user_company_id() FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.get_my_user_company_id() TO authenticated;

        RAISE LOG 'Function get_my_user_company_id created/replaced.';
