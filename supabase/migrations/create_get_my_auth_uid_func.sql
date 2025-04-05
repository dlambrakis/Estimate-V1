```sql
    /*
      # Create get_my_auth_uid Function

      **PURPOSE:** Creates a SECURITY DEFINER function to reliably retrieve the
      currently authenticated user's ID (`auth.uid()`).

      **BACKGROUND:** RLS policies involving joins can sometimes have issues with
      direct calls to functions like `auth.uid()` within the `USING` clause.
      Encapsulating this call in a `SECURITY DEFINER` function can sometimes
      resolve these issues by ensuring consistent execution context.

      **ACTION:**
      1. Create the function `public.get_my_auth_uid()` which returns `auth.uid()`.
      2. Set the function to `SECURITY DEFINER` to run with the privileges of the user who defined it (typically postgres).
      3. Set search path to empty to prevent potential hijacking.
    */

    CREATE OR REPLACE FUNCTION public.get_my_auth_uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    SECURITY DEFINER -- Important for consistent execution context in RLS
    -- Set a secure search path to prevent potential hijacking.
    SET search_path = ''
    AS $$
      SELECT auth.uid();
    $$;

    -- Grant execute permission to authenticated users
    GRANT EXECUTE ON FUNCTION public.get_my_auth_uid() TO authenticated;
    ```