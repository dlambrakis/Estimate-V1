/*
      # RLS Policy Alignment Update (v1)

      This migration updates existing Row Level Security (RLS) policies across multiple tables to ensure alignment with backend logic, the current database schema, and consistent authorization patterns.

      **Key Changes:**

      1.  **Standardization:** Replaced `get_my_role()` with `get_my_claim('role'::text)` for consistency with backend JWT handling.
      2.  **Removed JWT Claim Dependencies:** Removed reliance on potentially non-existent `companyId` and `resellerId` claims in `get_my_claim()`. Relationships are now derived via joins from `auth.uid()`.
      3.  **Corrected Reseller Admin Logic:** Updated policies to correctly identify the reseller managed by the logged-in Reseller Admin (`resellers.admin_user_id = auth.uid()`) and check resource linkage via `companies.reseller_id`.
      4.  **Enabled/Corrected User Management for Resellers:** Fixed the disabled policy (`Allow resellers to manage users in linked companies`) on the `users` table with the correct logic.
      5.  **Refined `resellers` Read Access:** Replaced the overly broad authenticated read access policy with role-specific SELECT policies.
      6.  **Utilized `addresses.company_id`:** Ensured policies correctly use the `addresses.company_id` column for linking.

      **Summary of Policy Updates by Table:**

      *   **`addresses`**:
          *   Updated `Allow GA/RA delete access`, `Allow GA/RA/CA insert/update access`, `Allow GA/RA/CA read access` to use `get_my_claim` and correct RA logic based on `resellers.admin_user_id` and `addresses.company_id`.
      *   **`companies`**:
          *   Updated `Allow GA/RA/CA insert/update/delete access`, `Allow Global Admin full access`, `Allow company admins to manage own company`, `Allow resellers to read linked companies`, `Allow users to read own company` to use `get_my_claim` and correct RA logic. Refined permissions slightly based on backend observations (e.g., CA primarily updates/selects).
      *   **`company_licenses`**:
          *   Updated `Allow GA/RA insert/update/delete access`, `Allow GA/RA/CA read access`, `Allow Global Admin full access`, `Allow company admins to view own company license`, `Allow resellers to read linked licenses` to use `get_my_claim`, remove `companyId`/`resellerId` claims, and correct RA logic. Added policy for Company Users to read their license.
      *   **`resellers`**:
          *   Updated `Allow Global Admin full access` to use `get_my_claim`.
          *   Dropped `Allow authenticated read access`.
          *   Added specific SELECT policies for GA, RA (own), and CA/Users (linked).
          *   Added specific UPDATE policy for RA (own).
          *   Added specific INSERT/DELETE policies for GA only.
      *   **`users`**:
          *   Updated `Allow Global Admin full access`, `Allow company admins to manage company users`, `Allow company admins to manage users in their company`, `Allow resellers to view linked company users`, `Allow users to manage own profile`, `Allow users to view own profile` to use `get_my_claim` and correct RA logic.
          *   Updated and enabled `Allow resellers to manage users in linked companies` (previously false/false) with correct RA logic and appropriate checks.

      **Note:** Policies granting `service_role` access remain unchanged.
    */

    -- ==== ADDRESSES ====

    -- Drop existing policies that will be replaced
    DROP POLICY IF EXISTS "Allow GA/RA delete access" ON public.addresses;
    DROP POLICY IF EXISTS "Allow GA/RA/CA insert/update access" ON public.addresses;
    DROP POLICY IF EXISTS "Allow GA/RA/CA read access" ON public.addresses;
    -- Keep "Allow service_role access"

    -- Policy: Allow Global Admins full access
    CREATE POLICY "Allow Global Admin full access on addresses"
      ON public.addresses FOR ALL
      USING (get_my_claim('role'::text) = 'global_admin'::text)
      WITH CHECK (get_my_claim('role'::text) = 'global_admin'::text);

    -- Policy: Allow Company Admins CRUD on their company's addresses
    CREATE POLICY "Allow Company Admin CRUD on own company addresses"
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
    CREATE POLICY "Allow Reseller Admin CRUD on managed company addresses"
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

    -- Drop existing policies that will be replaced or are redundant
    DROP POLICY IF EXISTS "Allow GA/RA/CA insert/update/delete access" ON public.companies;
    DROP POLICY IF EXISTS "Allow Global Admin full access" ON public.companies;
    DROP POLICY IF EXISTS "Allow company admins to manage own company" ON public.companies;
    DROP POLICY IF EXISTS "Allow resellers to read linked companies" ON public.companies;
    DROP POLICY IF EXISTS "Allow users to read own company" ON public.companies;
    -- Keep "Allow service_role access"

    -- Policy: Allow Global Admins full access
    CREATE POLICY "Allow Global Admin full access on companies"
      ON public.companies FOR ALL
      USING (get_my_claim('role'::text) = 'global_admin'::text)
      WITH CHECK (get_my_claim('role'::text) = 'global_admin'::text);

    -- Policy: Allow Company Admins SELECT/UPDATE on their own company
    CREATE POLICY "Allow Company Admin SELECT/UPDATE on own company"
      ON public.companies FOR UPDATE, SELECT
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

    -- Policy: Allow Reseller Admins SELECT/UPDATE on companies they manage
    CREATE POLICY "Allow Reseller Admin SELECT/UPDATE on managed companies"
      ON public.companies FOR UPDATE, SELECT
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
    CREATE POLICY "Allow Company User SELECT on own company"
      ON public.companies FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid() AND u.company_id = companies.id
        )
      );

    -- ==== COMPANY_LICENSES ====

    -- Drop existing policies that will be replaced
    DROP POLICY IF EXISTS "Allow GA/RA insert/update/delete access" ON public.company_licenses;
    DROP POLICY IF EXISTS "Allow GA/RA/CA read access" ON public.company_licenses;
    DROP POLICY IF EXISTS "Allow Global Admin full access" ON public.company_licenses;
    DROP POLICY IF EXISTS "Allow company admins to view own company license" ON public.company_licenses;
    DROP POLICY IF EXISTS "Allow global admins to view all licenses" ON public.company_licenses; -- Redundant with full access
    DROP POLICY IF EXISTS "Allow resellers to read linked licenses" ON public.company_licenses;
    -- Keep "Allow service_role access"

    -- Policy: Allow Global Admins full access
    CREATE POLICY "Allow Global Admin full access on company_licenses"
      ON public.company_licenses FOR ALL
      USING (get_my_claim('role'::text) = 'global_admin'::text)
      WITH CHECK (get_my_claim('role'::text) = 'global_admin'::text);

    -- Policy: Allow Reseller Admins full access on licenses of companies they manage
    CREATE POLICY "Allow Reseller Admin full access on managed company licenses"
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
    CREATE POLICY "Allow Company members SELECT on own company license"
      ON public.company_licenses FOR SELECT
      USING (
        (get_my_claim('role'::text) IN ('company_admin', 'company_user')) AND
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid() AND u.company_id = company_licenses.company_id
        )
      );


    -- ==== RESELLERS ====

    -- Drop existing policies that will be replaced
    DROP POLICY IF EXISTS "Allow Global Admin full access" ON public.resellers;
    DROP POLICY IF EXISTS "Allow authenticated read access" ON public.resellers;
    -- Keep "Allow service_role access"

    -- Policy: Allow Global Admins full access
    CREATE POLICY "Allow Global Admin full access on resellers"
      ON public.resellers FOR ALL
      USING (get_my_claim('role'::text) = 'global_admin'::text)
      WITH CHECK (get_my_claim('role'::text) = 'global_admin'::text);

    -- Policy: Allow Reseller Admins SELECT/UPDATE on their own reseller record
    CREATE POLICY "Allow Reseller Admin SELECT/UPDATE on own reseller record"
      ON public.resellers FOR SELECT, UPDATE
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
    CREATE POLICY "Allow Company members SELECT on linked reseller"
      ON public.resellers FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM users u
          JOIN companies c ON u.company_id = c.id
          WHERE u.id = auth.uid() AND c.reseller_id = resellers.id
        )
      );

    -- ==== USERS ====

    -- Drop existing policies that will be replaced
    DROP POLICY IF EXISTS "Allow Global Admin full access" ON public.users;
    DROP POLICY IF EXISTS "Allow company admins to manage company users" ON public.users;
    DROP POLICY IF EXISTS "Allow company admins to manage users in their company" ON public.users;
    DROP POLICY IF EXISTS "Allow resellers to manage users in linked companies" ON public.users;
    DROP POLICY IF EXISTS "Allow resellers to view linked company users" ON public.users;
    DROP POLICY IF EXISTS "Allow users to manage own profile" ON public.users;
    DROP POLICY IF EXISTS "Allow users to view own profile" ON public.users;
    -- Keep "Allow service_role access"

    -- Policy: Allow Global Admins full access (consider restricting deletion of other GAs)
    CREATE POLICY "Allow Global Admin full access on users"
      ON public.users FOR ALL
      USING (get_my_claim('role'::text) = 'global_admin'::text)
      -- Add check to prevent GA deleting other GAs if needed
      WITH CHECK (get_my_claim('role'::text) = 'global_admin'::text);

    -- Policy: Allow users to SELECT/UPDATE their own profile
    CREATE POLICY "Allow user SELECT/UPDATE on own profile"
      ON public.users FOR SELECT, UPDATE
      USING (auth.uid() = users.id)
      WITH CHECK (auth.uid() = users.id);
      -- Note: Delete is handled by auth.users triggers/admin API, not typically direct RLS on public.users

    -- Policy: Allow Company Admins full access to users in their own company (except other CAs?)
    CREATE POLICY "Allow Company Admin manage users in own company"
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
    CREATE POLICY "Allow Reseller Admin manage users in managed companies"
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
