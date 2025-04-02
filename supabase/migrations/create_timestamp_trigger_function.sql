/*
      # Create Timestamp Trigger Function

      This migration creates the reusable trigger function `public.trigger_set_timestamp()`
      which is used by multiple tables to automatically update their `updated_at` column.

      1. New Functions:
        - `public.trigger_set_timestamp()`: Updates the `updated_at` column of the row being modified to the current timestamp.
    */

    -- Trigger function to update 'updated_at' timestamp
    -- Use CREATE OR REPLACE for idempotency
    CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      -- Set the updated_at column of the NEW row to the current time
      NEW.updated_at = NOW();
      -- Return the modified row to be inserted/updated
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Grant execute permission on the function to the authenticated role
    -- This is often necessary for triggers defined by RLS policies or user actions
    GRANT EXECUTE ON FUNCTION public.trigger_set_timestamp() TO authenticated;
    -- Grant execute permission to the service_role as well
    GRANT EXECUTE ON FUNCTION public.trigger_set_timestamp() TO service_role;
