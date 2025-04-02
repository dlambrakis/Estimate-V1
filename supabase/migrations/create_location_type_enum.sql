/*
      # Create location_type Enum

      This migration defines the custom ENUM type `location_type`.

      1. New Enums:
        - `location_type`: Specifies the type of a physical location (e.g., Residential, Commercial).
    */
    -- Create location_type enum (using DO $$ for idempotency in migration file)
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'location_type') THEN
            CREATE TYPE public.location_type AS ENUM (
              'Residential',
              'Commercial',
              'Industrial',
              'Other'
            );
        END IF;
    END $$;
