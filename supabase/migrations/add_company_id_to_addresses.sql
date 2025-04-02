/*
      # Add company_id to addresses table

      This migration adds the necessary `company_id` column to the `public.addresses`
      table and establishes a foreign key relationship with the `public.companies` table.
      This column is required for RLS policies that link addresses to companies.

      1. Modified Tables:
        - `public.addresses`:
          - Added `company_id` (uuid, foreign key referencing `public.companies.id`).
          - Added index on `company_id`.

      2. Security:
        - No direct RLS changes in this file, but enables policies in other files.
    */

    -- Add the company_id column if it doesn't exist
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'addresses' AND column_name = 'company_id'
      ) THEN
        ALTER TABLE public.addresses ADD COLUMN company_id uuid;
      END IF;
    END $$;

    -- Add the foreign key constraint if it doesn't exist
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'addresses'
          AND constraint_name = 'addresses_company_id_fkey'
      ) THEN
        ALTER TABLE public.addresses
        ADD CONSTRAINT addresses_company_id_fkey
        FOREIGN KEY (company_id)
        REFERENCES public.companies(id)
        ON DELETE SET NULL; -- Or CASCADE, depending on desired behavior when a company is deleted
      END IF;
    END $$;

    -- Add an index on the new foreign key column for performance
    CREATE INDEX IF NOT EXISTS idx_addresses_company_id ON public.addresses(company_id);