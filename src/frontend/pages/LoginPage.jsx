import React, { useState } from 'react';
import { supabase } from '../../config/supabaseClientFrontend'; // Adjusted path
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Correct path

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth(); // Get role to redirect correctly after login

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (signInError) {
        console.error("Login error:", signInError);
        setError(signInError.message || 'Failed to log in. Please check your credentials.');
        setLoading(false);
        return;
      }

      console.log("Login successful, user data:", data.user);

      // The AuthContext listener will handle setting user/role state.
      // We just need to navigate. Determine where to redirect.
      const from = location.state?.from?.pathname || getDashboardPath(role || data.user?.user_metadata?.role); // Use role from context or newly fetched user data as fallback

      console.log("Navigating to:", from);
      navigate(from, { replace: true });

    } catch (catchError) {
      console.error("Unexpected login error:", catchError);
      setError('An unexpected error occurred during login.');
      setLoading(false);
    }
  };

    // Helper function to determine the correct dashboard path based on role
    // Duplicated here for immediate redirection logic, ideally centralize this
    const getDashboardPath = (userRole) => {
      switch (userRole) {
        case 'company_admin':
          return '/company-dashboard';
        case 'reseller_admin':
          return '/reseller-dashboard';
        case 'global_admin':
          return '/global-dashboard';
        default:
          console.warn("LoginPage: Could not determine dashboard for role:", userRole);
          return '/'; // Fallback to root, App.jsx will handle further redirection
      }
    };


  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">EstiMate Login</h2>
        <form className="space-y-6" onSubmit={handleLogin}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
