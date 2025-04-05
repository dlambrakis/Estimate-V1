import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext'; // Correct path
import LoginPage from './pages/LoginPage'; // Correct path
import CompanyAdminDashboard from './pages/CompanyAdminDashboard'; // Correct path
import ResellerAdminDashboard from './pages/ResellerAdminDashboard'; // Correct path
import GlobalAdminDashboard from './pages/GlobalAdminDashboard'; // Correct path
import CompanyUserDashboard from './pages/CompanyUserDashboard'; // Import the new dashboard
import ProtectedRoute from './components/ProtectedRoute'; // Correct path

// Helper function to determine the correct dashboard path based on role
const getDashboardPath = (role) => {
  console.log(`App.jsx: getDashboardPath called with role: ${role}`); // Log role input
  switch (role) {
    case 'company_admin':
      return '/company-dashboard';
    case 'reseller_admin':
      return '/reseller-dashboard';
    case 'global_admin':
      return '/global-dashboard';
    case 'company_user': // Add case for company_user
      return '/user-dashboard'; // Direct to the new dashboard
    default:
      console.warn(`App.jsx: Unknown role '${role}', defaulting dashboard path to /login`);
      // Fallback if role is unknown or user has no specific role dashboard
      return '/login'; // Defaulting to login might cause issues if already logged in, but let's see
  }
};


function App() {
  const { user, loading, role } = useAuth();

  console.log(`App.jsx: Rendering - Loading: ${loading}, User: ${!!user}, Role: ${role}`); // Log state on render

  if (loading) {
    console.log("App.jsx: Rendering Loading state...");
    return <div>Loading...</div>; // Or a proper loading spinner
  }

  // Calculate dashboard path *after* loading is false
  const dashboardPath = user ? getDashboardPath(role) : '/login';
  console.log(`App.jsx: Calculated dashboardPath: ${dashboardPath}`); // Log calculated path

  return (
    <Router>
      <Routes>
        {/* Public Route */}
        <Route
          path="/login"
          element={
            !user ? (
              <LoginPage />
            ) : (
              <Navigate to={dashboardPath} replace /> // Use calculated path
            )
          }
        />

        {/* Protected Routes */}
        <Route
          path="/company-dashboard"
          element={
            <ProtectedRoute user={user} allowedRoles={['company_admin']}>
              <CompanyAdminDashboard />
            </ProtectedRoute>
          }
        />
         <Route
          path="/reseller-dashboard"
          element={
            <ProtectedRoute user={user} allowedRoles={['reseller_admin']}>
              <ResellerAdminDashboard />
            </ProtectedRoute>
          }
        />
         <Route
          path="/global-dashboard"
          element={
            <ProtectedRoute user={user} allowedRoles={['global_admin']}>
              <GlobalAdminDashboard />
            </ProtectedRoute>
          }
        />
        {/* Add Route for Company User Dashboard */}
        <Route
          path="/user-dashboard"
          element={
            <ProtectedRoute user={user} allowedRoles={['company_user']}>
              <CompanyUserDashboard />
            </ProtectedRoute>
          }
        />

        {/* Redirect root based on login status and role */}
        <Route
          path="/"
          element={
            user ? (
              <Navigate to={dashboardPath} replace /> // Use calculated path
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Catch-all for unmatched routes (optional) */}
        {/* Redirect to login if not logged in, or dashboard if logged in */}
        <Route path="*" element={<Navigate to={dashboardPath} replace />} />
      </Routes>
    </Router>
  );
}

export default App;
