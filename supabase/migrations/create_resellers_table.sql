/*
      # Create Resellers Table

      This migration sets up the `public.resellers` table, referencing `public.addresses`.
      It depends on the `public.users` table for its RLS policies.

      1. New Tables:
        - `public.resellers`
          - `id` (uuid, primary key)
          - `reseller_name` (text, not null)
          - `contact_person` (text, not null)
          - `contact_email` (text, not null, unique)
          - `contact_phone` (text, not null)
          - `commission_rate` (numeric(5,4), not null, default 0.0, check >= 0 and <= 1)
          - `address_id` (uuid, foreign key -> public.addresses(id), on delete set null)
          - `created_at` (timestamptz, default now(), not null)
          - `updated_at` (timestamptz, default now(), not null)

      2. Relationships:
        - Foreign key `address_id` references `public.addresses(id)` with ON DELETE SET NULL.

      3. Indexes:
        - Index on `address_id`.

      4. Triggers:
        - A trigger (`set_timestamp`) using `public.trigger_set_timestamp()` to automatically update `updated_at`.

      5. Security:
        - Enable RLS on `public.resellers`.
        - Policies:
          - Authenticated users can read (placeholder, likely needs refinement).
          - Global Admins have full access (checks `public.users` table).
          - `service_role` has full access.
    */

    -- Create resellers table in public schema
    CREATE TABLE IF NOT EXISTS public.resellers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reseller_name text NOT NULL,
      contact_person text NOT NULL,
      contact_email text NOT NULL UNIQUE,
      contact_phone text NOT NULL,
      commission_rate numeric(5, 4) NOT NULL DEFAULT 0.0 CHECK (commission_rate >= 0 AND commission_rate <= 1),
      address_id uuid REFERENCES public.addresses(id) ON DELETE SET NULL, -- Explicit reference
      created_at timestamptz DEFAULT now() NOT NULL,
      updated_at timestamptz DEFAULT now() NOT NULL -- Added updated_at
    );

    -- Add indexes
    CREATE INDEX IF NOT EXISTS idx_resellers_address_id ON public.resellers(address_id);

    -- Apply trigger to resellers table for updated_at
    -- Drop trigger first if it exists, then create
    DROP TRIGGER IF EXISTS set_timestamp ON public.resellers;
    CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON public.resellers
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp(); -- Reuse the function

    -- Enable RLS
    ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;

    -- Policies
    -- Basic Read Policy (Placeholder - refine later)
    DROP POLICY IF EXISTS "Allow authenticated read access" ON public.resellers;
    CREATE POLICY "Allow authenticated read access"
      ON public.resellers
      FOR SELECT
      TO authenticated
      USING (true); -- Placeholder: Needs refinement based on roles (e.g., only Admins/Resellers?)

    -- Allow Global Admins full access (Checks users table)
    DROP POLICY IF EXISTS "Allow Global Admin full access" ON public.resellers;
    CREATE POLICY "Allow Global Admin full access"
      ON public.resellers
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.users u -- Depends on users table
          WHERE u.id = auth.uid() AND u.role = 'GlobalAdmin'
        )
      );

    -- Allow service_role full access
    DROP POLICY IF EXISTS "Allow service_role access" ON public.resellers;
    CREATE POLICY "Allow service_role access"
      ON public.resellers
      FOR ALL
      TO service_role
      USING (true);
