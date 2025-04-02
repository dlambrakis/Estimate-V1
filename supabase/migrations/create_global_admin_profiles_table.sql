/*
      # Create Global Admin Profiles Table

      This migration sets up the `global_admin_profiles` table, storing specific details for the global administrative entity. Typically, there would only be one row in this table representing the application owner/provider. It depends on the `addresses` table and the `trigger_set_timestamp` function. RLS depends on the `users` table.

      1. New Tables:
        - `public.global_admin_profiles`
          - `id` (uuid, primary key): Unique identifier. Consider using a fixed UUID or singleton constraint if only one should exist.
          - `organization_name` (text, not null): Name of the organization managing the application.
          - `contact_email` (text, not null): Primary contact email.
          - `contact_phone` (text, not null): Primary contact phone.
          - `address_id` (uuid, foreign key -> public.addresses(id) ON DELETE SET NULL): Link to the address.
          - `created_at` (timestamptz, default now(), not null): Timestamp of creation.
          - `updated_at` (timestamptz, default now(), not null): Timestamp of last update (auto-updated by trigger).

      2. Relationships:
        - Foreign key constraint from `global_admin_profiles.address_id` to `public.addresses(id)` ON DELETE SET NULL.

      3. Indexes:
        - Index on `address_id`.

      4. Triggers:
        - `set_timestamp` trigger on `global_admin_profiles` to call `public.trigger_set_timestamp()` before update.

      5. Security:
        - Enable RLS on the `public.global_admin_profiles` table.
        - Add policies: Only users with the 'GlobalAdmin' role (checked via `public.users`) can manage this profile.
        - `service_role` has full access.
    */

    -- Create global_admin_profiles table in public schema
    CREATE TABLE IF NOT EXISTS public.global_admin_profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_name text NOT NULL,
      contact_email text NOT NULL,
      contact_phone text NOT NULL,
      address_id uuid REFERENCES public.addresses(id) ON DELETE SET NULL,
      created_at timestamptz DEFAULT now() NOT NULL,
      updated_at timestamptz DEFAULT now() NOT NULL
    );

    -- Add indexes
    CREATE INDEX IF NOT EXISTS idx_global_admin_profiles_address_id ON public.global_admin_profiles(address_id);

    -- Apply trigger to global_admin_profiles table for updated_at
    DROP TRIGGER IF EXISTS set_timestamp ON public.global_admin_profiles;
    CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON public.global_admin_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp(); -- Reuse the function

    -- Enable RLS
    ALTER TABLE public.global_admin_profiles ENABLE ROW LEVEL SECURITY;

    -- Policies

    -- Drop existing policies before creating new ones
    DROP POLICY IF EXISTS "Allow Global Admins to manage profile" ON public.global_admin_profiles;
    DROP POLICY IF EXISTS "Allow service_role access" ON public.global_admin_profiles;

    -- Allow Global Admins (checked via users table) to manage the profile
    CREATE POLICY "Allow Global Admins to manage profile"
      ON public.global_admin_profiles
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid() AND u.role = 'GlobalAdmin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid() AND u.role = 'GlobalAdmin'
        )
      );

    -- Allow service_role full access
    CREATE POLICY "Allow service_role access"
      ON public.global_admin_profiles
      FOR ALL
      TO service_role
      USING (true);
