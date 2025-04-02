/*
      # Create Companies Table (Explicit Schema)

      This migration sets up the `public.companies` table, referencing `public.addresses` and `public.resellers`. It ensures idempotency using `IF NOT EXISTS`.

      1. New Tables:
        - `public.companies`
          - `id` (uuid, primary key)
          - `company_name` (text, not null)
          - `contact_person` (text, not null)
          - `contact_email` (text, not null, unique)
          - `contact_phone` (text, not null)
          - `address_id` (uuid, foreign key -> public.addresses(id) ON DELETE SET NULL)
          - `reseller_id` (uuid, foreign key -> public.resellers(id) ON DELETE SET NULL)
          - `stripe_customer_id` (text, unique)
          - `created_at` (timestamptz, default now(), not null)
          - `updated_at` (timestamptz, default now(), not null) -- Added updated_at

      2. Relationships:
        - `address_id` references `public.addresses(id)` ON DELETE SET NULL.
        - `reseller_id` references `public.resellers(id)` ON DELETE SET NULL.

      3. Indexes:
        - `idx_companies_address_id` on `address_id`.
        - `idx_companies_reseller_id` on `reseller_id`.

      4. Triggers:
         - `set_timestamp` trigger on UPDATE to set `updated_at`. -- Added trigger

      5. Security:
        - Enable RLS on `public.companies`.
        - Basic placeholder policies added (need refinement).
    */

    -- Create companies table in public schema
    CREATE TABLE IF NOT EXISTS public.companies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_name text NOT NULL,
      contact_person text NOT NULL,
      contact_email text NOT NULL UNIQUE,
      contact_phone text NOT NULL,
      address_id uuid REFERENCES public.addresses(id) ON DELETE SET NULL, -- Explicit reference
      reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL, -- Explicit reference
      stripe_customer_id text UNIQUE,
      created_at timestamptz DEFAULT now() NOT NULL,
      updated_at timestamptz DEFAULT now() NOT NULL -- Added updated_at
    );

    -- Add indexes
    CREATE INDEX IF NOT EXISTS idx_companies_address_id ON public.companies(address_id);
    CREATE INDEX IF NOT EXISTS idx_companies_reseller_id ON public.companies(reseller_id);

    -- Apply trigger to companies table using the pre-existing function
    -- Drop trigger first if it exists, then create
    DROP TRIGGER IF EXISTS set_timestamp ON public.companies;
    CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp(); -- Use the function created earlier

    -- Enable RLS
    ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

    -- Basic Policies (Placeholders - need refinement)
    DROP POLICY IF EXISTS "Allow users to read own company" ON public.companies;
    CREATE POLICY "Allow users to read own company"
      ON public.companies
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.company_id = public.companies.id
        )
      );

    DROP POLICY IF EXISTS "Allow company admins to manage own company" ON public.companies;
    CREATE POLICY "Allow company admins to manage own company"
      ON public.companies
      FOR ALL -- Consider restricting this later
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'CompanyAdmin' AND u.company_id = public.companies.id
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'CompanyAdmin' AND u.company_id = public.companies.id
        )
      );

    DROP POLICY IF EXISTS "Allow resellers to read linked companies" ON public.companies;
    CREATE POLICY "Allow resellers to read linked companies"
      ON public.companies
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role = 'ResellerAdmin' -- Assuming ResellerAdmin role
            AND public.companies.reseller_id = (SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'ResellerAdmin') -- Highly speculative link
        )
         -- TEMPORARY PERMISSIVE CLAUSE FOR TESTING - REMOVE
        OR public.companies.reseller_id IS NOT NULL
      );

    DROP POLICY IF EXISTS "Allow Global Admin full access" ON public.companies;
    CREATE POLICY "Allow Global Admin full access"
      ON public.companies
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'GlobalAdmin'
        )
      );

    DROP POLICY IF EXISTS "Allow service_role access" ON public.companies;
    CREATE POLICY "Allow service_role access"
      ON public.companies
      FOR ALL
      TO service_role
      USING (true);
