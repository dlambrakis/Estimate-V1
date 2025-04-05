// src/backend/middleware/authMiddleware.js
import jwt from 'jsonwebtoken'; // Keep for jwt.decode
import crypto from 'crypto'; // Import crypto for manual verification
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// --- Log JWT Library Version (Still useful for decode) ---
try {
    const jwtPkg = require('jsonwebtoken/package.json');
    console.log(`AuthMiddleware: Using jsonwebtoken version: ${jwtPkg.version} (primarily for decode)`);
} catch (e) {
    console.error("AuthMiddleware: Could not determine jsonwebtoken version.", e);
}
// -----------------------------

console.log("AuthMiddleware: Module loading...");

const RAW_JWT_SECRET_FROM_ENV = process.env.JWT_SECRET;
const isProduction = process.env.NODE_ENV === 'production';

console.log(`AuthMiddleware: Checking RAW_JWT_SECRET from env. Raw value found: '${RAW_JWT_SECRET_FROM_ENV}'`);

if (!RAW_JWT_SECRET_FROM_ENV || RAW_JWT_SECRET_FROM_ENV === 'your-super-secret-and-strong-jwt-secret-key') {
    console.error("FATAL ERROR: JWT_SECRET environment variable is missing, empty, or still using the default placeholder value.");
    console.error(`FATAL ERROR: Current value of process.env.JWT_SECRET during check: '${RAW_JWT_SECRET_FROM_ENV}'`);
    console.error("Please ensure JWT_SECRET is correctly set in your .env file with the PLAIN TEXT secret from Supabase.");
    process.exit(1);
}

// --- Trim potential whitespace ---
const RAW_JWT_SECRET = RAW_JWT_SECRET_FROM_ENV.trim();
if (RAW_JWT_SECRET !== RAW_JWT_SECRET_FROM_ENV && !isProduction) {
    console.warn("AuthMiddleware: Trimmed whitespace from JWT_SECRET environment variable.");
}
console.log(`AuthMiddleware: Using trimmed RAW JWT_SECRET string (length: ${RAW_JWT_SECRET.length}) for manual verification.`);
// ---------------------------------


export const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        if (!isProduction) console.log("AuthMiddleware: No token provided");
        return res.status(401).json({ message: 'Authentication token required' });
    }

    if (!isProduction) {
        console.log("AuthMiddleware: Received token (length):", token.length);
        if (token.length > 10) {
            console.log(`AuthMiddleware: Token start/end: ${token.substring(0, 5)}...${token.slice(-5)}`);
        }
    }

    try {
        // --- MANUAL JWT VERIFICATION ---
        console.log("AuthMiddleware: Attempting MANUAL JWT verification using Node crypto...");

        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
            console.error("AuthMiddleware: Invalid JWT format - does not have 3 parts.");
            return res.status(401).json({ message: 'Invalid token format' });
        }

        const headerAndPayload = tokenParts[0] + '.' + tokenParts[1];
        const signatureFromToken = tokenParts[2];

        // Create HMAC SHA256
        const hmac = crypto.createHmac('sha256', RAW_JWT_SECRET);
        hmac.update(headerAndPayload);
        const calculatedDigest = hmac.digest('base64');

        // Convert Base64 to Base64URL
        const calculatedSignature = calculatedDigest
            .replace(/\+/g, '-') // Replace + with -
            .replace(/\//g, '_') // Replace / with _
            .replace(/=+$/, ''); // Remove trailing =

        if (calculatedSignature !== signatureFromToken) {
            console.error("AuthMiddleware: MANUAL VERIFICATION FAILED! Signatures do NOT match.");
            console.error(`AuthMiddleware: Calculated: ${calculatedSignature}`);
            console.error(`AuthMiddleware: From Token: ${signatureFromToken}`);
            return res.status(403).json({ message: 'Token signature is invalid' });
        }

        console.log("AuthMiddleware: MANUAL VERIFICATION SUCCESSFUL! Signature matches.");

        // --- Decode Payload (Signature is verified) ---
        // We can safely decode now. Using jwt.decode is convenient.
        const decoded = jwt.decode(token);

        if (!decoded) {
             console.error("AuthMiddleware: Could not decode token payload after successful signature verification.");
             return res.status(401).json({ message: 'Invalid token: Payload unreadable' });
        }

        // Check expiration MANUALLY (jwt.decode doesn't verify expiration)
        const currentTimestamp = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp < currentTimestamp) {
            console.log("AuthMiddleware: Token expired (checked manually).");
            return res.status(401).json({ message: 'Token expired' });
        }

        // --- Extract User Info ---
        const userId = decoded.sub;
        const userMetadataRole = decoded.user_metadata?.role;
        const topLevelRole = decoded.role; // Less reliable, prefer user_metadata

        if (!userId) {
             console.error("AuthMiddleware: JWT 'sub' claim (user ID) is missing.");
             return res.status(401).json({ message: 'Invalid token: User ID missing' });
        }

        // Prioritize user_metadata.role
        let assignedRole = userMetadataRole || topLevelRole;

        if (!assignedRole) {
            console.error(`AuthMiddleware: User role is missing in JWT claims (user_metadata.role, role) for user ${userId}. Denying access.`);
            return res.status(403).json({ message: 'Forbidden: Role information missing' });
        } else if (!userMetadataRole && topLevelRole === 'authenticated') {
            console.warn(`AuthMiddleware: User ${userId} has basic 'authenticated' role. Specific role missing in user_metadata.`);
            // Allow 'authenticated' if no specific role, but log warning.
            assignedRole = 'authenticated';
        } else if (!userMetadataRole && topLevelRole && topLevelRole !== 'authenticated') {
             if (!isProduction) console.log(`AuthMiddleware: Using top-level role '${topLevelRole}' for user ${userId} as user_metadata.role is missing.`);
             assignedRole = topLevelRole; // Fallback, but user_metadata is preferred
        } else if (userMetadataRole) {
             if (!isProduction) console.log(`AuthMiddleware: Using role '${userMetadataRole}' from user_metadata for user ${userId}.`);
             assignedRole = userMetadataRole;
        }


        req.user = {
            id: userId,
            role: assignedRole,
            email: decoded.email,
            // Add other relevant decoded fields if needed
        };

        if (!isProduction) console.log("AuthMiddleware: User attached to request:", req.user);

        next();

    } catch (err) {
        // Catch errors from crypto or other unexpected issues
        console.error(`AuthMiddleware: Unexpected error during manual token processing: ${err.name} - ${err.message}`);
        console.error(err.stack); // Log stack for unexpected errors
        return res.status(500).json({ message: 'Could not process token' });
    }
};

// --- Role Authorization Logic (Remains the same) ---
export const authorizeRole = (allowedRoles) => {
    return (req, res, next) => {
        const rolesToCheck = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

        if (!req.user || typeof req.user.role !== 'string') {
             console.warn("AuthorizeRole: User or role not found/invalid on request. Ensure authenticateToken runs first and populates req.user correctly.");
             return res.status(403).json({ message: 'Forbidden: Role information missing or invalid' });
        }

        const userRole = req.user.role;

        if (!isProduction) {
            console.log(`AuthorizeRole: Checking if user role "${userRole}" is in allowed roles: [${rolesToCheck.join(', ')}]`);
        }

        if (rolesToCheck.includes(userRole)) {
            if (!isProduction) console.log(`AuthorizeRole: Access GRANTED for role "${userRole}".`);
            next();
        } else {
            console.warn(`AuthorizeRole: Access DENIED for role "${userRole}". Required: ${rolesToCheck.join(', ')}`);
            res.status(403).json({ message: `Forbidden: Access denied for role "${userRole}"` });
        }
    };
};

export const isCompanyAdmin = authorizeRole(['company_admin']);
export const isResellerAdmin = authorizeRole(['reseller_admin']);
export const isGlobalAdmin = authorizeRole(['global_admin']);
// Ensure 'authenticated' is included if basic logged-in users need access to some routes
export const isAuthenticated = authorizeRole(['authenticated', 'company_admin', 'reseller_admin', 'global_admin']);
