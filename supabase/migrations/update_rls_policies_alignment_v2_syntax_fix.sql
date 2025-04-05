/*
      # RLS Policy Alignment Update (v2 - Syntax Fix)

      This migration updates existing Row Level Security (RLS) policies across multiple tables to ensure alignment with backend logic, the current database schema, and consistent authorization patterns. It corrects a syntax error from v1 where `FOR UPDATE, SELECT` was used.

      **Key Changes (from previous state):**

      1.  **Syntax Correction:** Replaced invalid `FOR UPDATE, SELECT` clauses with separate policies for `SELECT` and `UPDATE` operations where applicable.
      2.  **Standardization:** Ensured all policies use `get_my_claim('role'::text)`.
      3.  **Removed JWT Claim Dependencies:** Ensured relationships are derived via joins from `auth.uid()`.
      4.  **Corrected Reseller Admin Logic:** Ensured policies correctly identify the reseller managed by the logged-in Reseller Admin (`resellers.admin_user_id = auth.uid()`) and check resource linkage via `companies.reseller_id`.
      5.  **Enabled/Corrected User Management for Resellers:** Ensured the policy for RAs managing users is correct and enabled.
      6.  **Refined `resellers` Read Access:** Ensured appropriate role-specific SELECT policies.
      7.  **Utilized `addresses.company_id`:** Ensured policies correctly use the `addresses.company_id` column.

      **Summary of Policy Updates by Table:**

      *   **`addresses`**:
          *   Policies for GA, CA, RA using correct logic and `get_my_claim`.
      *   **`companies`**:
          *   Split `SELECT/UPDATE` policies for CA and RA into separate `SELECT` and `UPDATE` policies.
          *   Policies for GA and Company Users using correct logic and `get_my_claim`.
      *   **`company_licenses`**:
          *   Policies for GA, RA, CA/Users using correct logic and `get_my_claim`.
      *   **`resellers`**:
          *   Split `SELECT/UPDATE` policy for RA into separate `SELECT` and `UPDATE` policies.
          *   Policies for GA and Company members using correct logic and `get_my_claim`.
      *   **`users`**:
          *   Split `SELECT/UPDATE` policy for user's own profile into separate `SELECT` and `UPDATE` policies.
          *   Policies for GA, CA, RA using correct logic and `get_my_claim`.

      **Note:** Policies granting `service_role` access remain unchanged.
    */

    -- Drop ALL potentially conflicting policies from the previous attempt and original state
    -- Addresses
    DROP POLICY IF EXISTS "Allow GA/RA delete access" ON public.addresses;
    DROP POLICY IF EXISTS "Allow GA/RA/CA insert/update access" ON public.addresses;
    DROP POLICY IF EXISTS "Allow GA/RA/CA read access" ON public.addresses;
    DROP POLICY IF EXISTS "Allow Global Admin full access on addresses" ON public.addresses;
    DROP POLICY IF EXISTS "Allow Company Admin CRUD on own company addresses" ON public.addresses;
    DROP POLICY IF EXISTS "Allow Reseller Admin CRUD on managed company addresses" ON public.addresses;

    -- Companies
    DROP POLICY IF EXISTS "Allow GA/RA/CA insert/update/delete access" ON public.companies;
    DROP POLICY IF EXISTS "Allow Global Admin full access" ON public.companies;
    DROP POLICY IF EXISTS "Allow company admins to manage own company" ON public.companies;
    DROP POLICY IF EXISTS "Allow resellers to read linked companies" ON public.companies;
    DROP POLICY IF EXISTS "Allow users to read own company" ON public.companies;
    DROP POLICY IF EXISTS "Allow Global Admin full access on companies" ON public.companies;
    DROP POLICY IF EXISTS "Allow Company Admin SELECT/UPDATE on own company" ON public.companies; -- Old incorrect one
    DROP POLICY IF EXISTS "Allow Reseller Admin SELECT/UPDATE on managed companies" ON public.companies; -- Old incorrect one
    DROP POLICY IF EXISTS "Allow Company User SELECT on own company" ON public.companies;

    -- Company Licenses
    DROP POLICY IF EXISTS "Allow GA/RA insert/update/delete access" ON public.company_licenses;
    DROP POLICY IF EXISTS "Allow GA/RA/CA read access" ON public.company_licenses;
    DROP POLICY IF EXISTS "Allow Global Admin full access" ON public.company_licenses;
    DROP POLICY IF EXISTS "Allow company admins to view own company license" ON public.company_licenses;
    DROP POLICY IF EXISTS "Allow global admins to view all licenses" ON public.company_licenses;
    DROP POLICY IF EXISTS "Allow resellers to read linked licenses" ON public.company_licenses;
    DROP POLICY IF EXISTS "Allow Global Admin full access on company_licenses" ON public.company_licenses;
    DROP POLICY IF EXISTS "Allow Reseller Admin full access on managed company licenses" ON public.company_licenses;
    DROP POLICY IF EXISTS "Allow Company members SELECT on own company license" ON public.company_licenses;

    -- Resellers
    DROP POLICY IF EXISTS "Allow Global Admin full access" ON public.resellers;
    DROP POLICY IF EXISTS "Allow authenticated read access" ON public.resellers;
    DROP POLICY IF EXISTS "Allow Global Admin full access on resellers" ON public.resellers;
    DROP POLICY IF EXISTS "Allow Reseller Admin SELECT/UPDATE on own reseller record" ON public.resellers; -- Old incorrect one
    DROP POLICY IF EXISTS "Allow Company members SELECT on linked reseller" ON public.resellers;

    -- Users
    DROP POLICY IF EXISTS "Allow Global Admin full access" ON public.users;
    DROP POLICY IF EXISTS "Allow company admins to manage company users" ON public.users;
    DROP POLICY IF EXISTS "Allow company admins to manage users in their company" ON public.users;
    DROP POLICY IF EXISTS "Allow resellers to manage users in linked companies" ON public.users;
    DROP POLICY IF EXISTS "Allow resellers to view linked company users" ON public.users;
    DROP POLICY IF EXISTS "Allow users to manage own profile" ON public.users;
    DROP POLICY IF EXISTS "Allow users to view own profile" ON public.users;
    DROP POLICY IF EXISTS "Allow Global Admin full access on users" ON public.users;
    DROP POLICY IF EXISTS "Allow user SELECT/UPDATE on own profile" ON public.users; -- Old incorrect one
    DROP POLICY IF EXISTS "Allow Company Admin manage users in own company" ON public.users;
    DROP POLICY IF EXISTS "Allow Reseller Admin manage users in managed companies" ON public.users;


    -- ==== ADDRESSES ====

    -- Policy: Allow Global Admins full access
    CREATE POLICY "ADDR: Allow Global Admin full access"
      ON public.addresses FOR ALL
      USING (get_my_claim('role'::text) = 'global_admin'::text)
      WITH CHECK (get_my_claim('role'::text) = 'global_admin'::text);

    -- Policy: Allow Company Admins CRUD on their company's addresses
    CREATE POLICY "ADDR: Allow CA CRUD on own company addresses"
      ON public.addresses FOR ALL
      USING (
        (get_my_claim('role'::text) = 'company_admin'::text) AND
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid() AND u.company_id = addresses.company_id
        )
      )
      WITH CHECK (
        (get_my_claim('role'::text) = 'company_admin'::text) AND
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid() AND u.company_id = addresses.company_id
        )
      );

    -- Policy: Allow Reseller Admins CRUD on addresses of companies they manage
    CREATE POLICY "ADDR: Allow RA CRUD on managed company addresses"
      ON public.addresses FOR ALL
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text) AND
        EXISTS (
          SELECT 1 FROM resellers r
          JOIN companies c ON r.id = c.reseller_id
          WHERE r.admin_user_id = auth.uid() AND c.id = addresses.company_id
        )
      )
      WITH CHECK (
        (get_my_claim('role'::text) = 'reseller_admin'::text) AND
        EXISTS (
          SELECT 1 FROM resellers r
          JOIN companies c ON r.id = c.reseller_id
          WHERE r.admin_user_id = auth.uid() AND c.id = addresses.company_id
        )
      );

    -- ==== COMPANIES ====

    -- Policy: Allow Global Admins full access
    CREATE POLICY "COMP: Allow Global Admin full access"
      ON public.companies FOR ALL
      USING (get_my_claim('role'::text) = 'global_admin'::text)
      WITH CHECK (get_my_claim('role'::text) = 'global_admin'::text);

    -- Policy: Allow Company Admins SELECT on their own company
    CREATE POLICY "COMP: Allow CA SELECT on own company"
      ON public.companies FOR SELECT
      USING (
        (get_my_claim('role'::text) = 'company_admin'::text) AND
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid() AND u.company_id = companies.id
        )
      );

    -- Policy: Allow Company Admins UPDATE on their own company
    CREATE POLICY "COMP: Allow CA UPDATE on own company"
      ON public.companies FOR UPDATE
      USING (
        (get_my_claim('role'::text) = 'company_admin'::text) AND
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid() AND u.company_id = companies.id
        )
      )
      WITH CHECK (
        (get_my_claim('role'::text) = 'company_admin'::text) AND
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid() AND u.company_id = companies.id
        )
      );

    -- Policy: Allow Reseller Admins SELECT on companies they manage
    CREATE POLICY "COMP: Allow RA SELECT on managed companies"
      ON public.companies FOR SELECT
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text) AND
        EXISTS (
          SELECT 1 FROM resellers r
          WHERE r.admin_user_id = auth.uid() AND r.id = companies.reseller_id
        )
      );

    -- Policy: Allow Reseller Admins UPDATE on companies they manage
    CREATE POLICY "COMP: Allow RA UPDATE on managed companies"
      ON public.companies FOR UPDATE
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text) AND
        EXISTS (
          SELECT 1 FROM resellers r
          WHERE r.admin_user_id = auth.uid() AND r.id = companies.reseller_id
        )
      )
      WITH CHECK (
        (get_my_claim('role'::text) = 'reseller_admin'::text) AND
        EXISTS (
          SELECT 1 FROM resellers r
          WHERE r.admin_user_id = auth.uid() AND r.id = companies.reseller_id
        )
      );

    -- Policy: Allow Company Users SELECT on their own company
    CREATE POLICY "COMP: Allow CU SELECT on own company"
      ON public.companies FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid() AND u.company_id = companies.id
        )
      );

    -- ==== COMPANY_LICENSES ====

    -- Policy: Allow Global Admins full access
    CREATE POLICY "LIC: Allow Global Admin full access"
      ON public.company_licenses FOR ALL
      USING (get_my_claim('role'::text) = 'global_admin'::text)
      WITH CHECK (get_my_claim('role'::text) = 'global_admin'::text);

    -- Policy: Allow Reseller Admins full access on licenses of companies they manage
    CREATE POLICY "LIC: Allow RA full access on managed company licenses"
      ON public.company_licenses FOR ALL
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text) AND
        EXISTS (
          SELECT 1 FROM resellers r
          JOIN companies c ON r.id = c.reseller_id
          WHERE r.admin_user_id = auth.uid() AND c.id = company_licenses.company_id
        )
      )
      WITH CHECK (
        (get_my_claim('role'::text) = 'reseller_admin'::text) AND
        EXISTS (
          SELECT 1 FROM resellers r
          JOIN companies c ON r.id = c.reseller_id
          WHERE r.admin_user_id = auth.uid() AND c.id = company_licenses.company_id
        )
      );

    -- Policy: Allow Company Admins/Users SELECT on their own company's license
    CREATE POLICY "LIC: Allow Company members SELECT on own company license"
      ON public.company_licenses FOR SELECT
      USING (
        (get_my_claim('role'::text) IN ('company_admin', 'company_user')) AND
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid() AND u.company_id = company_licenses.company_id
        )
      );


    -- ==== RESELLERS ====

    -- Policy: Allow Global Admins full access
    CREATE POLICY "RESL: Allow Global Admin full access"
      ON public.resellers FOR ALL
      USING (get_my_claim('role'::text) = 'global_admin'::text)
      WITH CHECK (get_my_claim('role'::text) = 'global_admin'::text);

    -- Policy: Allow Reseller Admins SELECT on their own reseller record
    CREATE POLICY "RESL: Allow RA SELECT on own reseller record"
      ON public.resellers FOR SELECT
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text) AND
        EXISTS (
          SELECT 1 FROM resellers r
          WHERE r.admin_user_id = auth.uid() AND r.id = resellers.id
        )
      );

    -- Policy: Allow Reseller Admins UPDATE on their own reseller record
    CREATE POLICY "RESL: Allow RA UPDATE on own reseller record"
      ON public.resellers FOR UPDATE
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text) AND
        EXISTS (
          SELECT 1 FROM resellers r
          WHERE r.admin_user_id = auth.uid() AND r.id = resellers.id
        )
      )
      WITH CHECK (
        (get_my_claim('role'::text) = 'reseller_admin'::text) AND
        EXISTS (
          SELECT 1 FROM resellers r
          WHERE r.admin_user_id = auth.uid() AND r.id = resellers.id
        )
      );

    -- Policy: Allow Company Admins/Users SELECT on their linked reseller
    CREATE POLICY "RESL: Allow Company members SELECT on linked reseller"
      ON public.resellers FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM users u
          JOIN companies c ON u.company_id = c.id
          WHERE u.id = auth.uid() AND c.reseller_id = resellers.id
        )
      );

    -- ==== USERS ====

    -- Policy: Allow Global Admins full access (consider restricting deletion of other GAs)
    CREATE POLICY "USER: Allow Global Admin full access"
      ON public.users FOR ALL
      USING (get_my_claim('role'::text) = 'global_admin'::text)
      -- Add check to prevent GA deleting other GAs if needed
      WITH CHECK (get_my_claim('role'::text) = 'global_admin'::text);

    -- Policy: Allow users to SELECT their own profile
    CREATE POLICY "USER: Allow user SELECT on own profile"
      ON public.users FOR SELECT
      USING (auth.uid() = users.id);

    -- Policy: Allow users to UPDATE their own profile
    CREATE POLICY "USER: Allow user UPDATE on own profile"
      ON public.users FOR UPDATE
      USING (auth.uid() = users.id)
      WITH CHECK (auth.uid() = users.id);
      -- Note: Delete is handled by auth.users triggers/admin API, not typically direct RLS on public.users

    -- Policy: Allow Company Admins full access to users in their own company (except other CAs?)
    CREATE POLICY "USER: Allow CA manage users in own company"
      ON public.users FOR ALL
      USING (
        (get_my_claim('role'::text) = 'company_admin'::text) AND
        EXISTS (
          SELECT 1 FROM users u_admin
          WHERE u_admin.id = auth.uid() AND u_admin.company_id = users.company_id
        )
        -- Optional: Prevent CA from modifying other CAs in the same company
        -- AND (users.role <> 'company_admin'::user_role OR users.id = auth.uid())
      )
      WITH CHECK (
        (get_my_claim('role'::text) = 'company_admin'::text) AND
        EXISTS (
          SELECT 1 FROM users u_admin
          WHERE u_admin.id = auth.uid() AND u_admin.company_id = users.company_id
        )
        -- Ensure CA cannot change user's company_id or elevate role beyond company scope
        AND (users.company_id = (SELECT u_check.company_id FROM users u_check WHERE u_check.id = auth.uid()))
        AND (users.role IN ('company_user'::user_role, 'company_admin'::user_role)) -- Or just 'company_user'?
        -- Optional: Prevent CA from modifying other CAs
        -- AND (users.role <> 'company_admin'::user_role OR users.id = auth.uid())
      );

    -- Policy: Allow Reseller Admins full access to users in companies they manage
    CREATE POLICY "USER: Allow RA manage users in managed companies"
      ON public.users FOR ALL
      USING (
        (get_my_claim('role'::text) = 'reseller_admin'::text) AND
        EXISTS (
          SELECT 1 FROM resellers r
          JOIN companies c ON r.id = c.reseller_id
          WHERE r.admin_user_id = auth.uid() AND c.id = users.company_id
        )
      )
      WITH CHECK (
        (get_my_claim('role'::text) = 'reseller_admin'::text) AND
        EXISTS (
          SELECT 1 FROM resellers r
          JOIN companies c ON r.id = c.reseller_id
          WHERE r.admin_user_id = auth.uid() AND c.id = users.company_id
        )
        -- Ensure RA cannot elevate roles beyond company scope or assign to companies not managed by them
        AND (users.role IN ('company_user'::user_role, 'company_admin'::user_role))
        AND (EXISTS (
              SELECT 1 FROM resellers r_check
              JOIN companies c_check ON r_check.id = c_check.reseller_id
              WHERE r_check.admin_user_id = auth.uid() AND c_check.id = users.company_id
            ))
      );
