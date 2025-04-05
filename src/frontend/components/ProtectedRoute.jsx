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
    // Redirect to their appropriate dashboard based on their actual role
     let fallbackPath = '/login'; // Default fallback
     if (role === 'company_admin') fallbackPath = '/company-dashboard';
     else if (role === 'reseller_admin') fallbackPath = '/reseller-dashboard';
     else if (role === 'global_admin') fallbackPath = '/global-dashboard';
     else if (role === 'company_user') fallbackPath = '/user-dashboard'; // Add fallback for company_user

    return <Navigate to={fallbackPath} replace />;
  }

  // User is logged in and has the required role (or no specific role required)
  return children;
};

export default ProtectedRoute;
