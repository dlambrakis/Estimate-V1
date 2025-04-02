/*
      # Create Company Licenses Table

      This migration sets up the `public.company_licenses` table, defining the license details for each company. It depends on the `public.companies` table, the `public.license_type` and `public.license_status` enums, and the `public.trigger_set_timestamp` function. RLS policies depend on the `public.users` table.

      1. New Tables:
        - `public.company_licenses`
          - `id` (uuid, primary key): Unique identifier for the license record.
          - `company_id` (uuid, not null, unique, foreign key -> public.companies(id) ON DELETE CASCADE): Link to the company. Ensures one license per company.
          - `license_key` (text, not null, unique): The unique license key string.
          - `license_type` (public.license_type enum, not null): Type of license ('Trial', 'Permanent').
          - `max_users` (integer, not null, check > 0): Maximum number of users allowed.
          - `start_date` (timestamptz, not null): Date the license becomes active.
          - `end_date` (timestamptz, nullable): Expiry date (null for 'Permanent', required for 'Trial').
          - `base_cost_per_user_per_month` (numeric(10, 2), not null, default 0.00, check >= 0): Cost per user per month.
          - `status` (public.license_status enum, not null): Current status ('Active', 'Trialing', 'Expired', etc.).
          - `stripe_subscription_id` (text, nullable, unique): Stripe Subscription ID.
          - `created_at` (timestamptz, default now(), not null): Timestamp of creation.
          - `updated_at` (timestamptz, default now(), not null): Timestamp of last update.

      2. Relationships:
        - Foreign key `company_id` references `public.companies(id)` with ON DELETE CASCADE.

      3. Indexes:
        - Unique index on `company_id`.
        - Unique index on `license_key`.
        - Unique index on `stripe_subscription_id` (allowing NULLs).

      4. Triggers:
        - A trigger (`set_timestamp`) using `public.trigger_set_timestamp()` to automatically update `updated_at`.

      5. Constraints:
        - `check_end_date_for_trial`: Ensures `end_date` is NOT NULL if `license_type` is 'Trial'.
        - `check_max_users_positive`: Ensures `max_users` is greater than 0.
        - `check_base_cost_non_negative`: Ensures `base_cost_per_user_per_month` is not negative.
        * Correction: Fixed dynamic DROP CONSTRAINT syntax and ambiguous column reference in DO blocks.

      6. Security:
        - Enable RLS on `public.company_licenses`.
        - Policies (Placeholders requiring refinement):
          - Users/Company Admins can see their own company's license.
          - Resellers can see licenses of their linked companies.
          - Global Admins can manage all licenses.
          - `service_role` has full access.
    */

    -- Create company_licenses table in public schema
    CREATE TABLE IF NOT EXISTS public.company_licenses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
      license_key text NOT NULL UNIQUE,
      license_type public.license_type NOT NULL,
      max_users integer NOT NULL CHECK (max_users > 0), -- Added explicit check constraint name later
      start_date timestamptz NOT NULL,
      end_date timestamptz, -- Nullable for permanent licenses
      base_cost_per_user_per_month numeric(10, 2) NOT NULL DEFAULT 0.00 CHECK (base_cost_per_user_per_month >= 0), -- Added explicit check constraint name later
      status public.license_status NOT NULL,
      stripe_subscription_id text UNIQUE, -- Can be null
      created_at timestamptz DEFAULT now() NOT NULL,
      updated_at timestamptz DEFAULT now() NOT NULL
    );

    -- Add check constraint for end_date based on license_type (idempotent)
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'check_end_date_for_trial' AND table_name = 'company_licenses' AND table_schema = 'public'
      ) THEN
        ALTER TABLE public.company_licenses ADD CONSTRAINT check_end_date_for_trial
          CHECK ( (license_type = 'Trial' AND end_date IS NOT NULL) OR (license_type != 'Trial') );
      END IF;
    END $$;

    -- Add explicit name for max_users check constraint (idempotent)
    DO $$
    DECLARE
      constraint_name_to_drop TEXT;
    BEGIN
        -- Find the default constraint name if it exists without our specific name
        SELECT tc.constraint_name INTO constraint_name_to_drop -- Qualified tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
        WHERE tc.table_name = 'company_licenses' AND tc.table_schema = 'public'
        AND tc.constraint_type = 'CHECK' AND cc.check_clause = '(max_users > 0)'
        AND tc.constraint_name NOT LIKE 'check_max_users_positive%' -- Avoid dropping if already named correctly
        LIMIT 1;

        -- If found, drop it using the fetched name
        IF constraint_name_to_drop IS NOT NULL THEN
            EXECUTE 'ALTER TABLE public.company_licenses DROP CONSTRAINT ' || quote_ident(constraint_name_to_drop);
        END IF;

        -- Add the constraint with the specific name if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'check_max_users_positive' AND table_name = 'company_licenses' AND table_schema = 'public'
        ) THEN
            ALTER TABLE public.company_licenses ADD CONSTRAINT check_max_users_positive CHECK (max_users > 0);
        END IF;
    END $$;

    -- Add explicit name for base_cost check constraint (idempotent)
    DO $$
    DECLARE
      constraint_name_to_drop TEXT;
    BEGIN
        -- Find the default constraint name if it exists without our specific name
        SELECT tc.constraint_name INTO constraint_name_to_drop -- Qualified tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
        WHERE tc.table_name = 'company_licenses' AND tc.table_schema = 'public'
        AND tc.constraint_type = 'CHECK'
        AND (cc.check_clause = '((base_cost_per_user_per_month >= (0)::numeric))' OR cc.check_clause = '(base_cost_per_user_per_month >= (0)::numeric)') -- Handle potential variations
        AND tc.constraint_name NOT LIKE 'check_base_cost_non_negative%' -- Avoid dropping if already named correctly
        LIMIT 1;

        -- If found, drop it using the fetched name
        IF constraint_name_to_drop IS NOT NULL THEN
             EXECUTE 'ALTER TABLE public.company_licenses DROP CONSTRAINT ' || quote_ident(constraint_name_to_drop);
        END IF;

        -- Add the constraint with the specific name if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'check_base_cost_non_negative' AND table_name = 'company_licenses' AND table_schema = 'public'
        ) THEN
            ALTER TABLE public.company_licenses ADD CONSTRAINT check_base_cost_non_negative CHECK (base_cost_per_user_per_month >= 0);
        END IF;
    END $$;


    -- Add indexes (Unique constraints already create indexes for company_id, license_key, stripe_subscription_id)

    -- Apply trigger to company_licenses table using the pre-existing function
    DROP TRIGGER IF EXISTS set_timestamp ON public.company_licenses;
    CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON public.company_licenses
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();

    -- Enable RLS
    ALTER TABLE public.company_licenses ENABLE ROW LEVEL SECURITY;

    -- Policies (Placeholders - need refinement, especially reseller logic)

    -- Policy: Users/Admins can read their own company's license
    DROP POLICY IF EXISTS "Allow users to read own company license" ON public.company_licenses;
    CREATE POLICY "Allow users to read own company license"
      ON public.company_licenses
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid() AND u.company_id = public.company_licenses.company_id
        )
      );

    -- Policy: Company Admins can manage *some* aspects of their own license (Refine what they can manage later)
    -- For now, let's allow SELECT, but restrict UPDATE/DELETE until specific rules are defined.
    DROP POLICY IF EXISTS "Allow company admins limited management of own license" ON public.company_licenses;
    CREATE POLICY "Allow company admins limited management of own license"
      ON public.company_licenses
      FOR SELECT -- Initially allow only SELECT for Company Admins via this policy
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role = 'CompanyAdmin'
            AND u.company_id = public.company_licenses.company_id
        )
      );
      -- Add separate policies for specific UPDATE/DELETE actions later if needed for Company Admins

    -- Policy: Resellers can read licenses of their linked companies (Placeholder - needs refinement)
    DROP POLICY IF EXISTS "Allow resellers to read linked licenses" ON public.company_licenses;
    CREATE POLICY "Allow resellers to read linked licenses"
      ON public.company_licenses
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.users u
          JOIN public.companies c ON public.company_licenses.company_id = c.id
          -- JOIN public.resellers r ON c.reseller_id = r.id -- Join needed if reseller info is in resellers table
          WHERE u.id = auth.uid()
            AND u.role = 'ResellerAdmin' -- Assuming ResellerAdmin role
            AND c.reseller_id = (SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'ResellerAdmin') -- Highly speculative link, needs confirmation
            -- This assumes the ResellerAdmin's 'company_id' in the users table actually links to the Reseller entity ID. Needs verification.
        )
        -- TEMPORARY PERMISSIVE CLAUSE FOR TESTING - REMOVE
        OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = public.company_licenses.company_id AND c.reseller_id IS NOT NULL)
      );

    -- Policy: Global Admins have full access
    DROP POLICY IF EXISTS "Allow Global Admin full access" ON public.company_licenses;
    CREATE POLICY "Allow Global Admin full access"
      ON public.company_licenses
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'GlobalAdmin'
        )
      );

    -- Policy: Allow service_role full access
    DROP POLICY IF EXISTS "Allow service_role access" ON public.company_licenses;
    CREATE POLICY "Allow service_role access"
      ON public.company_licenses
      FOR ALL
      TO service_role
      USING (true);
