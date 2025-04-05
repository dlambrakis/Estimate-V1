/*
      # Update get_my_company_id Function v2

      This migration updates the `get_my_company_id` function to correctly identify the company managed by the currently authenticated user, using the direct link.

      1. Changes:
        - The function now queries the `public.companies` table.
        - It looks for a row where the `admin_user_id` matches the `auth.uid()` of the calling user.
        - It returns the `id` of that company.
        - If no matching company is found (e.g., the user is not a Company Admin linked via `admin_user_id`), it returns NULL.
        - This replaces the previous logic which likely checked `public.users.company_id`.

      2. Security:
        - Uses `SECURITY DEFINER` to bypass RLS on the `companies` table *within the function only*, allowing it to find the link even if the user doesn't normally have direct SELECT access based on other policies.
        - The function itself doesn't grant broad access; it only returns an ID used by *other* RLS policies (e.g., on the `users` table).
    */
    CREATE OR REPLACE FUNCTION public.get_my_company_id()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    SECURITY DEFINER -- Important to bypass RLS within the function
    -- Set search_path to prevent hijacking
    SET search_path = public
    AS $$
      SELECT id
      FROM public.companies
      WHERE admin_user_id = auth.uid()
      LIMIT 1;
    $$;

    RAISE LOG 'Function get_my_company_id updated to use companies.admin_user_id.';
