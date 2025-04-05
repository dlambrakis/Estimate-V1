/*
      # Fix Users Table RLS Recursion

      This migration addresses the "infinite recursion detected in policy for relation 'users'" (42P17) error.

      1.  **Problem:** The `USER: Allow CA manage users in own company` policy contained a subquery (`EXISTS (SELECT 1 FROM users u_admin WHERE u_admin.id = auth.uid() AND u_admin.company_id = users.company_id)`) that required reading the `users` table to determine the requesting user's company ID. This triggered the RLS check recursively.

      2.  **Solution:**
          *   Create a `SECURITY DEFINER` function `public.get_my_company_id()`. This function runs with the privileges of its owner, allowing it to safely query the `users` table for the calling user's (`auth.uid()`) company ID without triggering the caller's RLS policies during its execution.
          *   Drop the existing problematic policy (`USER: Allow CA manage users in own company`).
          *   Recreate the policy using the new `public.get_my_company_id()` function in both the `USING` and `WITH CHECK` clauses to compare the target user's `company_id` with the requesting admin's company ID.

      3.  **New Function:**
          *   `public.get_my_company_id()`: Returns the `company_id` (uuid) of the currently authenticated user (`auth.uid()`). Returns `NULL` if the user is not found. Marked as `SECURITY DEFINER` and `STABLE`.

      4.  **Modified Policy:**
          *   `USER: Allow CA manage users in own company`: Updated to use `users.company_id = public.get_my_company_id()` for checks, eliminating the recursive subquery.
    */

    -- 1. Create the SECURITY DEFINER function to get the current user's company_id safely
    CREATE OR REPLACE FUNCTION public.get_my_company_id()
    RETURNS uuid
    LANGUAGE sql
    STABLE -- Indicates the function cannot modify the database and always returns the same results for the same arguments within a single statement.
    SECURITY DEFINER -- Executes with the privileges of the user who defined it
    -- Set a secure search path: this prevents hijacking attacks by ensuring that only specific schemas are searched.
    SET search_path = public
    AS $$
      SELECT company_id FROM public.users WHERE id = auth.uid();
    $$;

    -- Grant execute permission to authenticated users
    GRANT EXECUTE ON FUNCTION public.get_my_company_id() TO authenticated;

    -- 2. Drop the old recursive policy
    DROP POLICY IF EXISTS "USER: Allow CA manage users in own company" ON public.users;

    -- 3. Recreate the policy using the new function
    CREATE POLICY "USER: Allow CA manage users in own company"
      ON public.users FOR ALL
      USING (
        (get_my_claim('role'::text) = 'company_admin'::text) AND
        -- Check if the target user's company matches the admin's company
        (users.company_id = public.get_my_company_id())
      )
      WITH CHECK (
        (get_my_claim('role'::text) = 'company_admin'::text) AND
        -- Ensure the admin cannot change the user's company or assign them to a different company
        (users.company_id = public.get_my_company_id()) AND
        -- Ensure CA cannot elevate role beyond company scope
        (users.role IN ('company_user'::user_role, 'company_admin'::user_role))
        -- Optional: Prevent CA from modifying other CAs in the same company (uncomment if needed)
        -- AND (users.role <> 'company_admin'::user_role OR users.id = auth.uid())
      );

    -- Optional: Re-grant permissions if necessary (though typically handled by roles)
    -- GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated; -- Adjust based on actual role needs