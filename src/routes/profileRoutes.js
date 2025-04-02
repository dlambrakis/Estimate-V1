// src/routes/profileRoutes.js
import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/authMiddleware.js';
// Import Supabase client if direct DB access is needed, otherwise rely on req.user
// import { supabase } from '../config/supabaseClient.js';

const router = express.Router();

// GET /api/profile/me
// Protected route: Requires authentication
// Returns information about the currently logged-in user
router.get('/me', authenticateToken, (req, res) => {
  // The authenticateToken middleware adds the user object (id, role) to req
  console.log(`Accessing /api/profile/me for user ID: ${req.user.id}, Role: ${req.user.role}`);

  // You could fetch more details from the DB here if needed,
  // but for this example, we'll return the info from the token.
  // Ensure sensitive information is not exposed.
  res.status(200).json({
    message: "Successfully accessed protected profile data.",
    user: {
      id: req.user.id,
      role: req.user.role
      // Add other non-sensitive details fetched during login/token creation if desired
    }
  });
});

// Example: Route restricted to specific roles
// GET /api/profile/admin-only
router.get(
    '/admin-only',
    authenticateToken, // First, ensure user is logged in
    authorizeRole(['GlobalAdmin', 'CompanyAdmin']), // Then, check if user has one of these roles
    (req, res) => {
        console.log(`Accessing /api/profile/admin-only for user ID: ${req.user.id}, Role: ${req.user.role}`);
        res.status(200).json({
            message: `Welcome Admin (${req.user.role})! You have access to this restricted area.`,
            user: req.user
        });
    }
);


// Example: Route restricted to Resellers or higher
router.get(
    '/reseller-info',
    authenticateToken,
    authorizeRole(['GlobalAdmin', 'ResellerAdmin']),
    (req, res) => {
        console.log(`Accessing /api/profile/reseller-info for user ID: ${req.user.id}, Role: ${req.user.role}`);
        res.status(200).json({
            message: `Welcome Reseller/Admin (${req.user.role})! Access granted.`,
            user: req.user
        });
    }
);


export default router;
