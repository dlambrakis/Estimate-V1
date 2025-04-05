/*
  # Create/Replace RPC Function: update_company_and_address (v6 - User String Fix + Correct Logic)

  This migration creates/replaces a PostgreSQL function `public.update_company_and_address`
  to atomically update a company's details and its associated address. This function
  is intended to be called by company admins to modify their own company information.

  **Version 6:** Incorporates user's suggested fix for handling JSONB strings with `%L`
  (passing the `jsonb` value directly) and corrects the logical placement of the address
  INSERT operation into the `ELSE` block of the `IF v_current_address_id IS NOT NULL` check.

  1.  **Function:**
      - `public.update_company_and_address(p_company_updates jsonb, p_address_updates jsonb)`
      - **Parameters:**
          - `p_company_updates`: JSONB object with company fields to update (e.g., `{"company_name": "New Name"}`). Allowed keys: `company_name`, `contact_person`, `contact_email`, `contact_phone`, `stripe_customer_id`.
          - `p_address_updates`: JSONB object with address fields to update/insert (e.g., `{"street_address": "123 Main St"}`). Allowed keys: `country`, `state_province`, `city`, `suburb`, `location_type`, `street_address`, `street_number`, `complex_building_name`, `unit_number`, `postal_code`.
      - **Returns:** JSON object containing the full, updated company data including address and reseller details.
      - **Security:** `SECURITY INVOKER` - Runs with the permissions of the calling user. Relies on RLS and internal checks.
      - **Logic:**
          - Verifies the calling user (`auth.uid()`) is a 'company_admin'.
          - Retrieves the user's `company_id`.
          - Dynamically builds and executes UPDATE statement for `public.companies` based on allowed keys in `p_company_updates`. Uses `%L` for `jsonb` strings, `%L` with `::text` cast for others. Automatically sets `updated_at`.
          - Retrieves the company's current `address_id`.
          - **If `address_id` exists** and `p_address_updates` is provided: Dynamically builds and executes UPDATE statement for `public.addresses` based on allowed keys. Uses `%L` formatting as above. Automatically sets `updated_at` via trigger.
          - **If `address_id` does *not* exist** and `p_address_updates` is provided: Dynamically builds and executes INSERT statement for `public.addresses`, setting `company_id`. Sets default `location_type` to 'company' if not provided. Updates `public.companies.address_id` with the new address ID. Uses `%L` formatting as above.
          - Fetches and returns the complete updated company profile (joins with addresses and resellers).
          - Raises exceptions on authorization failure or SQL errors.

  2.  **Permissions:**
      - Grants `EXECUTE` permission on the function to the `authenticated` role.
*/

CREATE OR REPLACE FUNCTION public.update_company_and_address(
    p_company_updates jsonb,
    p_address_updates jsonb
)
RETURNS json -- Return JSON object representing the updated company
LANGUAGE plpgsql
SECURITY INVOKER -- Run as the calling user, relying on RLS + explicit checks
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_company_id uuid;
    v_current_address_id uuid;
    v_new_address_id uuid;
    v_allowed_company_keys text[] := ARRAY['company_name', 'contact_person', 'contact_email', 'contact_phone', 'stripe_customer_id'];
    v_allowed_address_keys text[] := ARRAY['country', 'state_province', 'city', 'suburb', 'location_type', 'street_address', 'street_number', 'complex_building_name', 'unit_number', 'postal_code'];
    v_company_update_sql text := '';
    v_address_update_sql text := '';
    v_address_insert_sql text := '';
    v_update_pairs text[];
    v_insert_cols text[];
    v_insert_vals text[];
    v_key text;
    v_value jsonb;
    v_update_fragment text;
    updated_company_data json;
BEGIN
    -- 1. Get the company_id associated with the calling user (must be company_admin)
    SELECT company_id INTO v_company_id
    FROM public.users
    WHERE id = v_user_id AND role = 'company_admin'; -- Ensure user is a company admin

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'User % is not a company admin or not found.', v_user_id;
    END IF;

    RAISE LOG 'User % (Company Admin for Company %) initiating update.', v_user_id, v_company_id;

    -- 2. Update Company Table (if p_company_updates is not empty and has valid keys)
    IF p_company_updates IS NOT NULL AND jsonb_object_keys(p_company_updates)::text[] <> ARRAY[]::text[] THEN
        v_update_pairs := ARRAY[]::text[];
        FOR v_key IN SELECT k FROM jsonb_object_keys(p_company_updates) k LOOP
            IF v_key = ANY(v_allowed_company_keys) THEN
                v_value := p_company_updates -> v_key;
                v_update_fragment := NULL; -- Reset fragment

                IF v_value IS NULL OR jsonb_typeof(v_value) = 'null' THEN
                    v_update_fragment := format('%I = NULL', v_key);
                ELSIF jsonb_typeof(v_value) = 'string' THEN
                   -- FIX v6: Use %L directly with jsonb string value
                   v_update_fragment := format('%I = %L', v_key, v_value);
                ELSE -- Numbers, booleans
                   -- Use %L with explicit text cast for non-string literals
                   v_update_fragment := format('%I = %L', v_key, v_value::text);
                END IF;

                IF v_update_fragment IS NOT NULL THEN
                    RAISE LOG 'Company Update Fragment: %', v_update_fragment;
                    v_update_pairs := array_append(v_update_pairs, v_update_fragment);
                END IF;
            ELSE
                 RAISE LOG 'Skipping disallowed company key: %', v_key;
            END IF;
        END LOOP;

        IF array_length(v_update_pairs, 1) > 0 THEN
            -- Add updated_at automatically
            v_update_pairs := array_append(v_update_pairs, format('updated_at = %L', now()::text));
            v_company_update_sql := format('UPDATE public.companies SET %s WHERE id = %L',
                                           array_to_string(v_update_pairs, ', '),
                                           v_company_id);
            RAISE LOG 'Executing Company Update SQL: %', v_company_update_sql;
            EXECUTE v_company_update_sql;
        ELSE
             RAISE LOG 'No valid company fields provided for update.';
        END IF;
    END IF;

    -- 3. Handle Address Update/Insert (if p_address_updates is not empty and has valid keys)
    IF p_address_updates IS NOT NULL AND jsonb_object_keys(p_address_updates)::text[] <> ARRAY[]::text[] THEN
        -- Get current address_id for the company
        SELECT address_id INTO v_current_address_id FROM public.companies WHERE id = v_company_id;

        IF v_current_address_id IS NOT NULL THEN
            -- Update existing address
            v_update_pairs := ARRAY[]::text[];
            FOR v_key IN SELECT k FROM jsonb_object_keys(p_address_updates) k LOOP
                 IF v_key = ANY(v_allowed_address_keys) THEN
                    v_value := p_address_updates -> v_key;
                    v_update_fragment := NULL; -- Reset fragment

                    IF v_value IS NULL OR jsonb_typeof(v_value) = 'null' THEN
                        v_update_fragment := format('%I = NULL', v_key);
                    ELSIF jsonb_typeof(v_value) = 'string' THEN
                       -- FIX v6: Use %L directly with jsonb string value
                       v_update_fragment := format('%I = %L', v_key, v_value);
                    ELSE -- Numbers, booleans
                       -- Use %L with explicit text cast for non-string literals
                       v_update_fragment := format('%I = %L', v_key, v_value::text);
                    END IF;

                    IF v_update_fragment IS NOT NULL THEN
                         RAISE LOG 'Address Update Fragment: %', v_update_fragment;
                         v_update_pairs := array_append(v_update_pairs, v_update_fragment);
                    END IF;
                 ELSE
                    RAISE LOG 'Skipping disallowed address key: %', v_key;
                 END IF;
            END LOOP;

            IF array_length(v_update_pairs, 1) > 0 THEN
                -- updated_at is handled by trigger on addresses table
                v_address_update_sql := format('UPDATE public.addresses SET %s WHERE id = %L AND company_id = %L',
                                               array_to_string(v_update_pairs, ', '),
                                               v_current_address_id,
                                               v_company_id);
                RAISE LOG 'Executing Address Update SQL: %', v_address_update_sql;
                EXECUTE v_address_update_sql;
            ELSE
                 RAISE LOG 'No valid address fields provided for update.';
            END IF;

        ELSE
            -- Insert new address (Correctly placed in ELSE block)
            v_insert_cols := ARRAY['company_id'];
            v_insert_vals := ARRAY[format('%L', v_company_id)];
            DECLARE
                has_location_type boolean := false;
            BEGIN
                FOR v_key IN SELECT k FROM jsonb_object_keys(p_address_updates) k LOOP
                     IF v_key = ANY(v_allowed_address_keys) THEN
                        v_value := p_address_updates -> v_key;
                        v_insert_cols := array_append(v_insert_cols, format('%I', v_key));
                         IF v_value IS NULL OR jsonb_typeof(v_value) = 'null' THEN
                             v_insert_vals := array_append(v_insert_vals, 'NULL');
                         ELSIF jsonb_typeof(v_value) = 'string' THEN
                            -- FIX v6: Use %L directly with jsonb string value
                            v_insert_vals := array_append(v_insert_vals, format('%L', v_value));
                         ELSE -- Numbers, booleans
                            -- Use %L with explicit text cast for non-string literals
                            v_insert_vals := array_append(v_insert_vals, format('%L', v_value::text));
                         END IF;
                         IF v_key = 'location_type' THEN
                            has_location_type := true;
                         END IF;
                     ELSE
                        RAISE LOG 'Skipping disallowed address key for insert: %', v_key;
                     END IF;
                END LOOP;

                 IF NOT has_location_type THEN
                     RAISE LOG 'No location_type provided, defaulting to ''company''';
                     v_insert_cols := array_append(v_insert_cols, 'location_type');
                     v_insert_vals := array_append(v_insert_vals, format('%L', 'company'));
                 END IF;


                IF array_length(v_insert_cols, 1) > 1 THEN -- Check if more than just company_id was added
                    v_address_insert_sql := format('INSERT INTO public.addresses (%s) VALUES (%s) RETURNING id',
                                                   array_to_string(v_insert_cols, ', '),
                                                   array_to_string(v_insert_vals, ', '));
                    RAISE LOG 'Executing Address Insert SQL: %', v_address_insert_sql;
                    EXECUTE v_address_insert_sql INTO v_new_address_id;

                    -- Link the new address to the company
                    UPDATE public.companies SET address_id = v_new_address_id, updated_at = now() WHERE id = v_company_id;
                    RAISE LOG 'Linked new address % to company %', v_new_address_id, v_company_id;
                ELSE
                    RAISE LOG 'No valid address fields provided for insert.';
                END IF;
            END; -- End inner block for insert variable scope
        END IF; -- End IF v_current_address_id IS NOT NULL / ELSE
    END IF; -- End IF p_address_updates IS NOT NULL

    -- 4. Fetch and return the updated company data
    SELECT json_strip_nulls(json_build_object(
        'id', c.id,
        'company_name', c.company_name,
        'contact_person', c.contact_person,
        'contact_email', c.contact_email,
        'contact_phone', c.contact_phone,
        'stripe_customer_id', c.stripe_customer_id,
        'created_at', c.created_at,
        'updated_at', c.updated_at,
        'address_id', c.address_id,
        'reseller_id', c.reseller_id,
        'address', (SELECT row_to_json(a.*) FROM public.addresses a WHERE a.id = c.address_id),
        'reseller', (
            SELECT json_build_object(
                'id', r.id,
                'name', r.reseller_name,
                'contact_email', r.contact_email,
                'contact_phone', r.contact_phone,
                'address', (SELECT row_to_json(ra.*) FROM public.addresses ra WHERE ra.id = r.address_id)
            )
            FROM public.resellers r WHERE r.id = c.reseller_id
        )
    ))
    INTO updated_company_data
    FROM public.companies c
    WHERE c.id = v_company_id;

    IF updated_company_data IS NULL THEN
        RAISE EXCEPTION 'Failed to retrieve updated company data for company %.', v_company_id;
    END IF;

    RETURN updated_company_data;

EXCEPTION
    WHEN raise_exception THEN
        RAISE WARNING '[AUTH_ERROR] update_company_and_address: %', SQLERRM;
        RAISE EXCEPTION '%', SQLERRM;
    WHEN others THEN
        RAISE WARNING '[SQL_ERROR] update_company_and_address: Error Code: %, Message: %', SQLSTATE, SQLERRM;
        RAISE EXCEPTION 'An internal error occurred while updating company information.';
END;
$$;

-- Grant execute permission
DO $$
BEGIN
  IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'update_company_and_address'
  ) THEN
      GRANT EXECUTE ON FUNCTION public.update_company_and_address(jsonb, jsonb) TO authenticated;
      RAISE LOG 'Granted EXECUTE on public.update_company_and_address(jsonb, jsonb) to authenticated';
  ELSE
      RAISE LOG 'Function public.update_company_and_address(jsonb, jsonb) not found, skipping GRANT.';
  END IF;
END $$;
