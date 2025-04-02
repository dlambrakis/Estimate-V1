// src/config/supabaseClient.js (Backend)
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("ERROR: Supabase URL or Anon Key is missing in environment variables.");
  // Optionally throw an error to prevent the application from starting without config
  // throw new Error("Supabase URL or Anon Key is missing.");
}

// Standard client using the Anon key - suitable for operations respecting RLS
// Use this when you want operations to be performed as an anonymous user or
// when the user's JWT will be passed to Supabase (e.g., via setSession)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // Disable automatic session persistence on the server-side client
        persistSession: false,
        // Optional: Disable auto-refreshing tokens on the server
        autoRefreshToken: false,
        // Optional: Detect session in URL - typically not needed on server
        detectSessionInUrl: false
    }
});

// Admin client using the Service Role key - bypasses RLS
// Use this ONLY for operations that need to bypass RLS, like administrative tasks,
// internal data processing, or specific service operations where RLS is not applicable
// or needs to be overridden. BE EXTREMELY CAREFUL WITH THIS.
let supabaseAdmin = null;
if (supabaseServiceRoleKey) {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });
    console.log("Supabase Admin client initialized (Service Role Key detected).");
} else {
    console.warn("Supabase Service Role Key not found. Admin client not initialized. Operations requiring elevated privileges will fail.");
    // You might want a fallback or a different way to handle the absence of the admin client
    // For now, we'll just leave it null. Functions attempting to use it should check first.
}

export { supabaseAdmin };

// Function to create a new admin client instance (useful for specific services like licenseService)
export const createAdminClient = () => {
    if (!supabaseServiceRoleKey) {
        console.error("Cannot create Admin Client: Service Role Key is missing.");
        // Depending on how critical this is, you might throw an error
        // or return null/undefined and let the caller handle it.
        // throw new Error("Supabase Service Role Key is missing. Cannot create admin client.");
        return null;
    }
    return createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });
};
