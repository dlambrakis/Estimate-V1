// src/backend/middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import { supabase } from '../../config/supabaseClient.js'; // Adjusted path

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables.");
    // Optionally exit the process if JWT secret is critical for startup
    // process.exit(1);
}

export const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) {
        console.log("AuthMiddleware: No token provided");
        return res.status(401).json({ message: 'Authentication token required' });
    }

    try {
        // 1. Verify JWT signature locally using the secret
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log("AuthMiddleware: JWT verified locally, decoded:", decoded);

        // 2. Optional but recommended: Verify the token with Supabase Auth to ensure it hasn't been revoked
        //    This requires setting the session for the Supabase client instance.
        //    Note: supabase (anon key client) cannot validate arbitrary tokens directly without user context.
        //    Instead, we rely on the local verification and the short expiry of JWTs.
        //    For stricter validation, you might need a Supabase Admin client call here,
        //    or structure your RLS policies to implicitly validate the user's existence/status.

        // 3. Attach decoded user information (including Supabase user ID and custom claims like role) to the request object
        req.user = {
            id: decoded.sub, // Supabase User ID from 'sub' claim
            role: decoded.user_metadata?.role || decoded.role, // Get role from metadata or root claim
            email: decoded.email,
            // Add any other relevant claims you put in your JWT
        };
         console.log("AuthMiddleware: User attached to request:", req.user);

        if (!req.user.id) {
             console.error("AuthMiddleware: JWT 'sub' claim (user ID) is missing.");
             return res.status(401).json({ message: 'Invalid token: User ID missing' });
        }
         if (!req.user.role) {
             console.warn("AuthMiddleware: User role is missing in JWT claims.");
             // Decide if this is an error or just a warning depending on your app logic
             // return res.status(401).json({ message: 'Invalid token: User role missing' });
         }


        next(); // Proceed to the next middleware or route handler
    } catch (err) {
        console.error("AuthMiddleware: Token verification failed:", err.message);
        if (err instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ message: 'Token expired' });
        }
        if (err instanceof jwt.JsonWebTokenError) {
            return res.status(403).json({ message: 'Token is invalid' });
        }
        // Handle other potential errors during verification
        return res.status(500).json({ message: 'Could not process token' });
    }
};


// Middleware to authorize based on role
export const authorizeRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            console.warn("AuthorizeRole: User or role not found on request. Ensure authenticateToken runs first.");
            // This case should ideally be caught by authenticateToken, but check defensively
            return res.status(403).json({ message: 'Forbidden: Role information missing' });
        }

        const userRole = req.user.role;
        console.log(`AuthorizeRole: Checking if user role "${userRole}" is in allowed roles: [${allowedRoles.join(', ')}]`);

        if (Array.isArray(allowedRoles) && allowedRoles.includes(userRole)) {
            next(); // Role is allowed, proceed
        } else {
            console.warn(`AuthorizeRole: Access denied for role "${userRole}". Required: ${allowedRoles.join(', ')}`);
            res.status(403).json({ message: `Forbidden: Access denied for role "${userRole}"` });
        }
    };
};

// Example alias for specific roles if needed (though using authorizeRole directly is often clearer)
export const isCompanyAdmin = authorizeRole(['company_admin']);
export const isResellerAdmin = authorizeRole(['reseller_admin']);
export const isGlobalAdmin = authorizeRole(['global_admin']);
