// src/middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined in .env file.");
  process.exit(1); // Stop the application if JWT_SECRET is missing
}

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) {
    console.log('Auth Middleware: No token provided.');
    return res.status(401).json({ message: 'Authentication token required.' }); // if there isn't any token
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('Auth Middleware: Token verification failed.', err.message);
      return res.status(403).json({ message: 'Invalid or expired token.' }); // if token is invalid or expired
    }

    // Token is valid, attach user info (id and role) to the request object
    // Ensure the payload structure matches what's generated in authService.js
    if (!user || !user.sub || !user.role) {
        console.error('Auth Middleware: Invalid token payload structure.', user);
        return res.status(403).json({ message: 'Invalid token payload.' });
    }

    req.user = {
        id: user.sub, // Standard JWT claim for subject (user ID)
        role: user.role // Custom claim for user role
    };
    console.log('Auth Middleware: Token verified successfully for user:', req.user.id, 'Role:', req.user.role);
    next(); // pass the execution off to whatever request the client intended
  });
};

// Optional: Middleware to check for specific roles
export const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      console.log('Authorization Middleware: User not authenticated or role missing.');
      // This should technically be caught by authenticateToken first
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const hasRole = allowedRoles.includes(req.user.role);
    if (!hasRole) {
        console.log(`Authorization Middleware: User role '${req.user.role}' not in allowed roles [${allowedRoles.join(', ')}].`);
        return res.status(403).json({ message: 'Forbidden: Insufficient permissions.' }); // User role not allowed
    }

    console.log(`Authorization Middleware: Role '${req.user.role}' authorized.`);
    next(); // User has the required role
  };
};
