/*
      # Create Users Table

      This migration sets up the `users` table, which stores application-specific user profile information, linking to Supabase's built-in authentication (`auth.users`).

      1. New Tables:
        - `users`
          - `id` (uuid, primary key, foreign key -> auth.users.id): Links to the authenticated user. **Crucially, this MUST match the `id` in `auth.users`**.
          - `company_id` (uuid, foreign key -> companies.id): The company the user belongs to. **NOTE: This FK constraint will be added LATER after the `companies` table exists.**
          - `first_name` (text, not null): User's first name.
          - `last_name` (text, not null): User's last name.
          - `email` (text, not null, unique): User's email address. Should be kept in sync with `auth.users.email`.
          - `role` (user_role enum, not null): User's role within the application.
          - `is_active` (boolean, not null, default true): Whether the user account is active.
          - `license_consumed` (boolean, not null, default false): Whether this user counts towards the company's license limit.
          - `created_at` (timestamptz, default now()): Timestamp of profile creation.
          - `updated_at` (timestamptz, default now()): Timestamp of last profile update.

      2. Relationships:
        - Foreign key constraint from `users.id` to `auth.users.id`. Ensures user profile exists only for authenticated users. Cascade delete ensures profile is removed if auth user is deleted.
        - **Deferred**: Foreign key constraint from `users.company_id` to `companies.id`. Will be added in a separate migration after `companies` table is created.

      3. Indexes:
        - Unique index on `email`.
        - Index on `company_id`.

      4. Triggers:
        - A trigger (`set_timestamp`) using `public.trigger_set_timestamp()` to automatically update `updated_at` timestamp on any row modification.
        - **IMPORTANT**: A trigger should ideally be created to automatically insert a new row into this `users` table when a new user signs up via `auth.users`. This ensures profile data consistency. (Deferring complex trigger for now).
        - **IMPORTANT**: A trigger or application logic should keep `users.email` in sync with `auth.users.email` if the email is updated in Supabase Auth.

      5. Security:
        - Enable RLS on the `users` table.
        - Add policies:
          - Users can view and update their own profile.
          - Company Admins can view/manage users within their own company (policy will be refined when FK to companies is added).
          - Resellers can view users of companies linked to them (placeholder, needs refinement).
          - Global Admins can manage all users.
    */

    -- Create users table
    CREATE TABLE IF NOT EXISTS public.users (
      id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- Links to Supabase auth user
      company_id uuid, -- FK constraint added later
      first_name text NOT NULL,
      last_name text NOT NULL,
      email text NOT NULL UNIQUE, -- Should match auth.users.email
      role user_role NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      license_consumed boolean NOT NULL DEFAULT false,
      created_at timestamptz DEFAULT now() NOT NULL,
      updated_at timestamptz DEFAULT now() NOT NULL
    );

    -- Add indexes
    CREATE INDEX IF NOT EXISTS idx_users_company_id ON public.users(company_id);
    -- Note: Unique constraint on email already creates an index. Primary key on id also creates an index.

    -- Apply trigger to users table for updated_at
    -- Drop trigger first if it exists, then create
    DROP TRIGGER IF EXISTS set_timestamp ON public.users;
    CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp(); -- Reuse the function created earlier

    -- Enable RLS
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

    -- Policies
    -- Drop policies if they exist before creating
    DROP POLICY IF EXISTS "Allow users to manage own profile" ON public.users;
    CREATE POLICY "Allow users to manage own profile"
      ON public.users
      FOR ALL
      TO authenticated
      USING (auth.uid() = id);

    -- Company Admins can view/manage users in their company (Placeholder - needs company_id FK and check)
    DROP POLICY IF EXISTS "Allow company admins to manage company users" ON public.users;
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
            AND u.company_id = users.company_id -- Check if the admin belongs to the same company as the target user
        )
      );

    -- Resellers can view users of their companies (Placeholder - needs role check and company link)
    DROP POLICY IF EXISTS "Allow resellers to view linked company users" ON public.users;
    CREATE POLICY "Allow resellers to view linked company users"
      ON public.users
      FOR SELECT
      TO authenticated
      USING (
        -- Placeholder: Needs proper check involving resellers table and company linkage
        -- This policy likely needs significant revision once the reseller<->company relationship is solid.
        -- For now, restrict to Global Admins to avoid overly permissive access.
        EXISTS (
          SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'GlobalAdmin'
        )
      );

    -- Global Admins can manage all users
    DROP POLICY IF EXISTS "Allow Global Admin full access" ON public.users;
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
    DROP POLICY IF EXISTS "Allow service_role access" ON public.users;
    CREATE POLICY "Allow service_role access"
      ON public.users
      FOR ALL
      TO service_role
      USING (true);
