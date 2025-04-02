// src/frontend/config/supabaseClientFrontend.js (Frontend)
import { createClient } from '@supabase/supabase-js';

// Use Vite's import.meta.env for environment variables on the client-side
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("ERROR: Supabase URL or Anon Key is missing. Check your .env file and ensure variables are prefixed with VITE_");
  // You might want to display an error to the user or prevent the app from loading fully
}

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // Enable session persistence in the browser's local storage
        persistSession: true,
        // Allow Supabase client to automatically refresh the session token
        autoRefreshToken: true,
        // Detect session from URL hash (useful for email magic links, though not used here)
        detectSessionInUrl: true
    }
});
