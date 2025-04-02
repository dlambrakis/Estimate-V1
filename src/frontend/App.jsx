import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext'; // Correct path
import LoginPage from './pages/LoginPage'; // Correct path
import CompanyAdminDashboard from './pages/CompanyAdminDashboard'; // Correct path
import ResellerAdminDashboard from './pages/ResellerAdminDashboard'; // Correct path
import GlobalAdminDashboard from './pages/GlobalAdminDashboard'; // Correct path
import ProtectedRoute from './components/ProtectedRoute'; // Correct path

function App() {
  const { user, loading, role } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // Or a proper loading spinner
  }

  return (
    <Router>
      <Routes>
        {/* Public Route */}
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to={getDashboardPath(role)} replace />} />

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

        {/* Redirect root based on login status and role */}
        <Route
          path="/"
          element={
            user ? <Navigate to={getDashboardPath(role)} replace /> : <Navigate to="/login" replace />
          }
        />

        {/* Catch-all for unmatched routes (optional) */}
        <Route path="*" element={<Navigate to={user ? getDashboardPath(role) : "/login"} replace />} />
      </Routes>
    </Router>
  );
}

// Helper function to determine the correct dashboard path based on role
const getDashboardPath = (role) => {
  switch (role) {
    case 'company_admin':
      return '/company-dashboard';
    case 'reseller_admin':
      return '/reseller-dashboard';
    case 'global_admin':
      return '/global-dashboard';
    default:
      // Fallback if role is unknown or user has no specific role dashboard
      // Redirecting to login might be safer if role determination fails
      return '/login';
  }
};

export default App;
