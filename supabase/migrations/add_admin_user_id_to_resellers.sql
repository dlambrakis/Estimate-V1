/*
      # Add Admin User ID to Resellers Table

      This migration adds a direct link from a reseller record to the user who administers it.

      1. Changes:
        - Add `admin_user_id` column to `public.resellers`.
          - Type: `uuid`
          - Constraint: Foreign Key referencing `auth.users(id)` ON DELETE SET NULL. Allows the reseller record to exist even if the admin user is deleted.
          - Constraint: UNIQUE. Ensures one user administers only one reseller.
          - Nullable: Yes (a reseller might not have an admin assigned initially).

      2. Indexes:
        - An index is automatically created for the foreign key.
        - An index is automatically created for the unique constraint.

      3. Security:
        - RLS policies on `resellers` might need review, but existing policies should still function. The new column itself doesn't grant access; policies do.
        - The `get_my_reseller_id_for_admin` function will be updated in a subsequent step to use this new column.
    */

    -- Add the admin_user_id column to the resellers table
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'resellers' AND column_name = 'admin_user_id'
      ) THEN
        ALTER TABLE public.resellers
        ADD COLUMN admin_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

        RAISE LOG 'Column admin_user_id added to public.resellers.';
      ELSE
        RAISE LOG 'Column admin_user_id already exists in public.resellers.';
      END IF;
    END $$;

    -- Add an index for potential lookups (though UNIQUE constraint might already create one)
    CREATE INDEX IF NOT EXISTS idx_resellers_admin_user_id ON public.resellers(admin_user_id);
