/*
      # Standardize User Roles - Step 2: Finalize Changes (Revised Step 8 - Policy Fix v2)

      This version fixes the RLS policy for `global_admin_profiles` which incorrectly
      referenced a non-existent `user_id` column. The policy now correctly checks
      if the calling user has the 'global_admin' role using `get_my_role()`.

      Assumes `standardize_roles_step1_prepare.sql` has been successfully applied.
      Assumes `add_company_id_to_addresses.sql` has been successfully applied.
      Uses `DROP FUNCTION ... CASCADE` and `DROP COLUMN ... CASCADE`.
      Recreates function/policies referencing the temporary `user_role_new` type
      *before* dropping the old type and renaming the new one.

      1. Drop Function (CASCADE): Drops `get_my_role()` and dependent policies.
      2. Drop Policies (Safety Net): Explicit drops for robustness (most handled by CASCADE).
      3. Drop Old Column (CASCADE): Removes `role` column and dependents.
      4. Rename New Column: Renames `role_new` to `role`.
      5. Recreate Function (using `user_role_new`): Recreates `get_my_role()` returning the temporary enum.
      6. Recreate RLS Policies: Recreates policies using the new function (with corrected global_admin_profiles policy).
      7. Drop Old Enum: Removes the original `user_role` (CamelCase).
      8. Rename New Enum & Recreate Function (Separated): Renames `user_role_new` to `user_role` (lowercase) inside a DO block, then recreates the function outside the DO block.
    */

    -- 1. Drop Dependent Function and Policies (using CASCADE)
    DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;

    -- 2. Drop Other Potentially Dependent RLS Policies (Safety Net - many might be gone due to CASCADE)
    DROP POLICY IF EXISTS "Allow Global Admin full access" ON public.resellers;
    DROP POLICY IF EXISTS "Allow company admins to manage own company" ON public.companies;
    DROP POLICY IF EXISTS "Allow Global Admins to manage profile" ON public.global_admin_profiles;
    DROP POLICY IF EXISTS "Allow company admins to view users in their company" ON public.users;
    DROP POLICY IF EXISTS "Allow global admins to view all companies" ON public.companies;
    DROP POLICY IF EXISTS "Allow resellers to view linked companies" ON public.companies;
    DROP POLICY IF EXISTS "Allow resellers to read linked companies" ON public.companies;
    DROP POLICY IF EXISTS "Allow resellers to view linked company users" ON public.users;
    DROP POLICY IF EXISTS "Allow GA to insert any company" ON public.companies;
    DROP POLICY IF EXISTS "Allow RA to insert companies for own reseller" ON public.companies;
    DROP POLICY IF EXISTS "Allow GA to update any company" ON public.companies;
    DROP POLICY IF EXISTS "Allow RA to update linked companies" ON public.companies;
    DROP POLICY IF EXISTS "Allow CA to update own company" ON public.companies;
    DROP POLICY IF EXISTS "Allow GA to delete any company" ON public.companies;
    DROP POLICY IF EXISTS "Allow RA to delete linked companies" ON public.companies;
    DROP POLICY IF EXISTS "Allow GA/RA to insert addresses" ON public.addresses;
    DROP POLICY IF EXISTS "Allow GA/RA/CA insert access" ON public.addresses;
    DROP POLICY IF EXISTS "
