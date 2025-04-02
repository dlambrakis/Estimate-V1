/*
      # Add Foreign Key: users.company_id -> companies.id

      This migration adds the previously deferred foreign key constraint to the `public.users` table, linking `company_id` to `public.companies(id)`. It also re-applies RLS policies on `users` that depend on this relationship.

      1. Constraints Added:
        - Adds `fk_users_company` constraint: `users.company_id` REFERENCES `companies(id)` ON DELETE SET NULL.
        - Uses `DO $$` block to add the constraint only if it doesn't already exist.

      2. RLS Policy Updates (Re-application):
        - Re-applies "Allow company admins to manage company users" policy on `public.users`. This policy relies on the `company_id` link.
        - Re-applies "Allow resellers to view linked company users" policy on `public.users`. Although still a placeholder, re-applying ensures consistency.
        - Re-applies "Allow Global Admin full access" policy on `public.users`.
        - Re-applies "Allow users to manage own profile" policy on `public.users`.
        - Re-applies "Allow service_role access" policy on `public.users`.

      3. Important Notes:
        - The ON DELETE SET NULL behavior means if a company is deleted, the `company_id` for associated users will become NULL. Consider if this is the desired behavior or if restriction/cascade is more appropriate.
        - The reseller policy remains a placeholder and needs refinement based on how resellers are linked to companies/users.
    */

    -- Add the foreign key constraint if it doesn't exist
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_users_company'
          AND table_schema = 'public'
          AND table_name = 'users'
      ) THEN
        ALTER TABLE public.users
        ADD CONSTRAINT fk_users_company
        FOREIGN KEY (company_id)
        REFERENCES public.companies(id)
        ON DELETE SET NULL; -- Or ON DELETE RESTRICT / CASCADE depending on requirements
      END IF;
    END $$;

    -- Re-apply RLS policies on users table that might depend on company_id or need refreshing

    -- Drop policies if they exist before creating
    DROP POLICY IF EXISTS "Allow users to manage own profile" ON public.users;
    DROP POLICY IF EXISTS "Allow company admins to manage company users" ON public.users;
    DROP POLICY IF EXISTS "Allow resellers to view linked company users" ON public.users; -- Placeholder
    DROP POLICY IF EXISTS "Allow Global Admin full access" ON public.users;
    DROP POLICY IF EXISTS "Allow service_role access" ON public.users;

    -- Re-create policies

    -- Users can manage their own profile
    CREATE POLICY "Allow users to manage own profile"
      ON public.users
      FOR ALL
      TO authenticated
      USING (auth.uid() = id);

    -- Company Admins can view/manage users in their company (Now uses the FK)
    CREATE POLICY "Allow company admins to manage company users"
      ON public.users
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role = 'CompanyAdmin'
            AND u.company_id = users.company_id -- Check against the target user's company_id
        )
      )
      WITH CHECK ( -- Ensure admin can only add/modify users within their own company
         EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role = 'CompanyAdmin'
            AND u.company_id = users.company_id
        )
      );

    -- Resellers can view users of their companies (Placeholder - needs refinement)
    CREATE POLICY "Allow resellers to view linked company users"
      ON public.users
      FOR SELECT -- Changed to SELECT only for now, as management logic is unclear
      TO authenticated
      USING (
        -- Placeholder: Needs proper check involving resellers table and company linkage.
        -- How is a reseller user linked to the companies they manage?
        -- Assuming a reseller user might have a role 'ResellerAdmin' and their company_id points to the Reseller's own company entry?
        -- Or perhaps a separate linking table is needed.
        -- For now, restrict to Global Admins to avoid overly permissive access.
        EXISTS (
          SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'GlobalAdmin'
        )
      );

    -- Global Admins can manage all users
    CREATE POLICY "Allow Global Admin full access"
      ON public.users
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid() AND u.role = 'GlobalAdmin'
        )
      );

    -- Allow service_role full access
    CREATE POLICY "Allow service_role access"
      ON public.users
      FOR ALL
      TO service_role
      USING (true);
