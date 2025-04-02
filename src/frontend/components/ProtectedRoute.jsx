import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Correct path

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div>Loading authentication state...</div>; // Or a spinner
  }

  if (!user) {
    // User not logged in, redirect to login page
    // Pass the current location so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // User is logged in but does not have the required role
    console.warn(`ProtectedRoute: Access denied for role "${role}". Required: ${allowedRoles.join(', ')}`);
    // Redirect to a generic dashboard or an unauthorized page
    // For simplicity, redirecting to login might force re-auth or show the correct dashboard if roles changed
    // A better approach might be a dedicated '/unauthorized' page or redirect based on their actual role's dashboard
     // Determine fallback path based on actual role
     let fallbackPath = '/login'; // Default fallback
     if (role === 'company_admin') fallbackPath = '/company-dashboard';
     else if (role === 'reseller_admin') fallbackPath = '/reseller-dashboard';
     else if (role === 'global_admin') fallbackPath = '/global-dashboard';

    return <Navigate to={fallbackPath} replace />;
  }

  // User is logged in and has the required role (or no specific role required)
  return children;
};

export default ProtectedRoute;
