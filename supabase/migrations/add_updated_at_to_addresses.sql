/*
  # Add updated_at to Addresses Table

  This migration adds an `updated_at` column to the `public.addresses` table and applies the existing `trigger_set_timestamp` function to automatically update it.

  1.  **Modified Tables:**
      - `public.addresses`:
        - Added `updated_at` (timestamptz, default now(), not null).

  2.  **Triggers:**
      - Added `set_timestamp` trigger on `UPDATE` for `public.addresses`.

  3.  **Reasoning:**
      - Provides tracking for when address records were last modified.
      - Maintains consistency with other tables like `companies`.
*/

-- Add the updated_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'addresses' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.addresses ADD COLUMN updated_at timestamptz DEFAULT now() NOT NULL;
  END IF;
END $$;

-- Apply the existing trigger function to the addresses table
-- Drop trigger first if it exists from a previous attempt, then create
DROP TRIGGER IF EXISTS set_timestamp ON public.addresses;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON public.addresses
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp(); -- Use the function created earlier
