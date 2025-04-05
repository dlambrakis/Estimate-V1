/*
      # Update get_my_reseller_id_for_admin Function v2

      This migration updates the `get_my_reseller_id_for_admin` function to correctly identify the reseller managed by the currently authenticated user.

      1. Changes:
        - The function now queries the `public.resellers` table.
        - It looks for a row where the `admin_user_id` matches the `auth.uid()` of the calling user.
        - It returns the `id` of that reseller.
        - If no matching reseller is found (e.g., the user is not a Reseller Admin linked via `admin_user_id`), it returns NULL.

      2. Security:
        - Uses `SECURITY DEFINER` to bypass RLS on the `resellers` table *within the function only*, allowing it to find the link even if the user doesn't normally have direct SELECT access based on other policies.
        - The function itself doesn't grant broad access; it only returns an ID used by *other* RLS policies (e.g., on the `companies` table).
    */
    CREATE OR REPLACE FUNCTION public.get_my_reseller_id_for_admin()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    SECURITY DEFINER -- Important to bypass RLS within the function
    -- Set search_path to prevent hijacking
    SET search_path = public
    AS $$
      SELECT id
      FROM public.resellers
      WHERE admin_user_id = auth.uid()
      LIMIT 1;
    $$;

    RAISE LOG 'Function get_my_reseller_id_for_admin updated to use admin_user_id.';
