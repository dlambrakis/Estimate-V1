/*
      # Create Other Enums

      This migration defines remaining custom ENUM types.

      1. New Enums:
        - `user_role`: Defines user roles.
        - `license_type`: Defines company license types.
    */
    -- Create user_role enum
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
            CREATE TYPE public.user_role AS ENUM (
              'GlobalAdmin',
              'ResellerAdmin',
              'CompanyAdmin',
              'CompanyUser'
            );
        END IF;
    END $$;

    -- Create license_type enum
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'license_type') THEN
            CREATE TYPE public.license_type AS ENUM (
              'Trial',
              'Permanent'
            );
        END IF;
    END $$;
