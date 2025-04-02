// src/services/authService.js
import { supabase } from '../config/supabaseClient.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h'; // Default to 1 hour expiration

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined in .env file.");
  process.exit(1);
}

export const loginUser = async (email, password) => {
  console.log(`Attempting login for email: ${email}`);

  // 1. Authenticate user with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (authError) {
    console.error('Supabase Auth Error:', authError.message);
    // Provide a generic error message for security
    return { success: false, message: 'Invalid login credentials.', status: 401 };
  }

  if (!authData || !authData.user) {
    console.error('Supabase Auth: No user data returned after successful sign in.');
    return { success: false, message: 'Login failed. Please try again.', status: 500 };
  }

  const userId = authData.user.id;
  console.log(`Supabase Auth successful for user ID: ${userId}`);

  // 2. Fetch user profile (including role) from public.users table
  //    We use the service role key implicitly here via the admin client,
  //    or rely on RLS allowing users to read their own profile if using user token.
  //    For login, using the admin client is safer as RLS might not be set up
  //    for unauthenticated reads even of one's own profile immediately after login.
  //    However, the standard client uses the anon key by default. Let's assume
  //    the RLS policy "Allow users to manage own profile" allows the logged-in user
  //    (identified by auth.uid()) to read their own row.
  //    Alternatively, use a service_role key for this backend operation.
  //    For simplicity now, we rely on the user's implicit session after signIn.

  //    Let's explicitly use the user's access token to fetch their profile
  //    to ensure RLS is respected correctly.
  const userSupabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
  });

  const { data: profileData, error: profileError } = await userSupabase
    .from('users')
    .select('role, company_id, first_name, last_name') // Select necessary profile data
    .eq('id', userId)
    .single(); // Expecting only one user profile

  if (profileError) {
    console.error(`Profile fetch error for user ${userId}:`, profileError.message);
    // Log out the user from Supabase session if profile fetch fails? Maybe not necessary.
    // await supabase.auth.signOut(); // Optional: Sign out if profile is missing/inaccessible
    return { success: false, message: 'Failed to retrieve user profile after login.', status: 500 };
  }

  if (!profileData) {
    console.error(`No profile found in public.users for authenticated user ID: ${userId}`);
    // await supabase.auth.signOut(); // Optional: Sign out
    return { success: false, message: 'User profile not found.', status: 404 };
  }

  const userRole = profileData.role;
  console.log(`User role fetched: ${userRole}`);

  // 3. Generate JWT
  const payload = {
    sub: userId, // Subject claim (standard for user ID)
    role: userRole, // Custom claim for role
    // Add other relevant, non-sensitive info if needed
    // companyId: profileData.company_id, // Example: if needed frequently
    // iat: Math.floor(Date.now() / 1000), // Issued at (added automatically by library)
    // exp: Math.floor(Date.now() / 1000) + (60 * 60) // Expiration time (added by library options)
  };

  try {
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    console.log(`JWT generated successfully for user ID: ${userId}`);
    return {
        success: true,
        message: 'Login successful.',
        token: token,
        user: { // Return some basic user info along with the token
            id: userId,
            email: authData.user.email, // Email from auth response
            role: userRole,
            firstName: profileData.first_name,
            lastName: profileData.last_name,
            companyId: profileData.company_id
        },
        status: 200
    };
  } catch (jwtError) {
      console.error(`JWT signing error for user ${userId}:`, jwtError);
      return { success: false, message: 'Failed to generate authentication token.', status: 500 };
  }
};

// Helper function needed within this service file
import { createClient } from '@supabase/supabase-js';
const createSupabaseClientForUser = (accessToken) => {
  if (!accessToken) {
    throw new Error("Access token is required to create a user-specific Supabase client.");
  }
  return createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
};
