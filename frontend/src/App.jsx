import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import CompanyAdminDashboard from './pages/CompanyAdminDashboard';
import ResellerAdminDashboard from './pages/ResellerAdminDashboard'; // Placeholder
import GlobalAdminDashboard from './pages/GlobalAdminDashboard'; // Placeholder
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';

function App() {
  const { user, loading } = useAuth(); // Get user and loading state

  if (loading) {
    return <div>Loading...</div>; // Or a spinner component
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Company Admin Routes */}
      <Route
        path="/company-admin"
        element={
          <ProtectedRoute allowedRoles={['company_admin']}>
            <CompanyAdminDashboard />
          </ProtectedRoute>
        }
      />

       {/* Reseller Admin Routes - Placeholder */}
       <Route
        path="/reseller-admin"
        element={
          <ProtectedRoute allowedRoles={['reseller_admin']}>
             <ResellerAdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Global Admin Routes - Placeholder */}
      <Route
        path="/global-admin"
        element={
          <ProtectedRoute allowedRoles={['global_admin']}>
            <GlobalAdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Redirect based on role after login, or to login if not authenticated */}
      <Route
        path="/"
        element={
          user ? (
            user.role === 'company_admin' ? <Navigate to="/company-admin" /> :
            user.role === 'reseller_admin' ? <Navigate to="/reseller-admin" /> :
            user.role === 'global_admin' ? <Navigate to="/global-admin" /> :
            <Navigate to="/login" /> // Fallback if role is unknown or not set
          ) : (
            <Navigate to="/login" />
          )
        }
      />

      {/* Catch-all for unknown routes */}
      <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
    </Routes>
  );
}

export default App;
