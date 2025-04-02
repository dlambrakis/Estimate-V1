import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div>Loading authentication status...</div>; // Or a proper loading spinner
  }

  if (!user) {
    // User not logged in
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
     // User logged in but does not have the required role
     console.warn(`Access denied for role: ${user.role}. Required: ${allowedRoles.join(', ')}`);
     // Redirect to a generic dashboard or login page, or show an unauthorized message
     // For simplicity, redirecting to login might be confusing. Let's redirect based on their actual role if possible, or just show an error/redirect to a safe default.
     // A better approach might be to redirect to their *actual* dashboard if they have one, or show an "Unauthorized" component.
     // For now, let's redirect back to login, although this isn't ideal UX.
     // A slightly better approach: redirect to their default route if known.
     const defaultRoute = user.role === 'company_admin' ? '/company-admin' :
                          user.role === 'reseller_admin' ? '/reseller-admin' :
                          user.role === 'global_admin' ? '/global-admin' : '/login'; // Fallback

     // Avoid redirecting to the same page if they are already there but lack permissions
     if (location.pathname === defaultRoute) {
        // If they are already on their default page but shouldn't be (e.g., trying to access /admin as company_admin), redirect to login
         return <Navigate to="/login" state={{ from: location }} replace />;
     } else {
         // Redirect them to their appropriate dashboard
         return <Navigate to={defaultRoute} replace />;
     }
  }

  // User is logged in and has the required role (or no specific role is required)
  return children;
};

export default ProtectedRoute;
