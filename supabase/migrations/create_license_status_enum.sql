/*
      # Create license_status Enum

      This migration defines the custom ENUM type `license_status`.

      1. New Enums:
        - `license_status`: Specifies the status of a company license (e.g., Active, Trialing, Expired).
    */
    -- Create license_status enum (using DO $$ for idempotency in migration file)
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'license_status') THEN
            CREATE TYPE public.license_status AS ENUM (
              'Active',
              'Trialing',
              'Expired',
              'Cancelled',
              'Pending Activation' -- Added for potential future use
            );
        END IF;
    END $$;
