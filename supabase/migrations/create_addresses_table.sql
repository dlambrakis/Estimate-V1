/*
      # Create Addresses Table

      This migration sets up the `public.addresses` table.

      1. New Tables:
        - `public.addresses`
          - Uses `public.location_type` enum.

      2. Security:
        - Enable RLS on `public.addresses`.
        - Basic policies added.
    */
    -- Create addresses table in public schema
    CREATE TABLE IF NOT EXISTS public.addresses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      country text NOT NULL,
      state_province text NOT NULL,
      city text NOT NULL,
      suburb text,
      location_type public.location_type NOT NULL, -- Uses the enum
      street_address text NOT NULL,
      street_number text NOT NULL,
      complex_building_name text,
      unit_number text,
      postal_code text NOT NULL,
      created_at timestamptz DEFAULT now() NOT NULL
    );

    -- Enable RLS
    ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

    -- Basic Read Policy
    CREATE POLICY "Allow authenticated read access"
      ON public.addresses
      FOR SELECT
      TO authenticated
      USING (true); -- Refine later

    -- Allow service_role full access
    CREATE POLICY "Allow service_role access"
      ON public.addresses
      FOR ALL
      TO service_role
      USING (true);
