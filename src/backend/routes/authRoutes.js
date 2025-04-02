// src/backend/routes/authRoutes.js
import express from 'express';
import { loginUser } from '../services/authService.js'; // Adjusted path
import { authenticateToken } from '../middleware/authMiddleware.js'; // Adjusted path

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        console.log("AuthRoutes: Received login request for:", email);
        const { user, session /*, profile */ } = await loginUser(email, password);
        console.log("AuthRoutes: Login successful, sending session token.");

        // Send back the session which contains the JWT access token and refresh token
        // The frontend Supabase client library knows how to handle this session object.
        res.json({
            message: "Login successful",
            user: user, // Send user object (contains ID, email, metadata like role)
            session: session, // Send session object (contains tokens)
            // profile: profile // Include profile if fetched and needed by frontend immediately
        });
    } catch (error) {
         console.error("AuthRoutes: Login failed:", error.message);
         // Send appropriate status code based on error type
         if (error.message.includes('Invalid email or password')) {
             res.status(401).json({ message: error.message }); // 401 Unauthorized
         } else if (error.message.includes('Email not confirmed')) {
             res.status(403).json({ message: error.message }); // 403 Forbidden (or custom code)
         }
         else {
             res.status(500).json({ message: error.message || 'An internal server error occurred during login.' });
         }
         // next(error); // Or pass to global error handler
    }
});


// Example: GET /api/auth/logout (might not be strictly needed if frontend handles Supabase logout)
// If you implement server-side session management beyond Supabase, you'd clear it here.
// For Supabase-only auth, the frontend client's signOut() is usually sufficient.
router.post('/logout', authenticateToken, async (req, res) => {
     // The authenticateToken middleware verifies the JWT is valid before allowing logout.
     try {
         // Invalidate the token on Supabase side
         // Note: supabase (anon client) needs the token to invalidate it.
         const token = req.headers['authorization'].split(' ')[1];
         const { error } = await supabase.auth.admin.signOut(token); // Requires admin client usually? Check docs.
         // OR rely on frontend supabase.auth.signOut() which handles local storage etc.

         // For a stateless JWT approach, logout is mainly handled client-side by discarding the token.
         // Server-side, you might add the token JTI (JWT ID) to a blacklist if needed.

         console.log(`AuthRoutes: User ${req.user.id} logout request received.`);
         res.status(200).json({ message: 'Logout endpoint called. Client should clear session.' });
     } catch (error) {
         console.error("AuthRoutes: Error during logout:", error);
         res.status(500).json({ message: 'Logout failed.' });
     }
 });


export default router;
