// server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors'; // Import CORS

// Load environment variables from .env file in the root
dotenv.config();

// Import routes (adjust paths based on new structure)
import authRoutes from './src/backend/routes/authRoutes.js';
import profileRoutes from './src/backend/routes/profileRoutes.js';
import companyRoutes from './src/backend/routes/companyRoutes.js'; // Assuming you have this
import userRoutes from './src/backend/routes/userRoutes.js'; // Assuming you have this
import licenseRoutes from './src/backend/routes/licenseRoutes.js'; // Assuming you have this

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001; // Use port from env or default to 3001

// --- Middleware ---
// Enable CORS for all origins (adjust in production!)
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Logging middleware (optional but helpful)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- Routes ---
// Mount all API routes under /api
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/companies', companyRoutes); // Example mount point
app.use('/api/users', userRoutes); // Example mount point
app.use('/api/licenses', licenseRoutes); // Example mount point


// Basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).send('EstiMate API is running!');
});

// --- Error Handling ---
// Basic 404 handler for API routes not found
app.use('/api/*', (req, res, next) => { // Only apply 404 to /api paths
  res.status(404).json({ message: 'API Endpoint Not Found' });
});

// Global error handler for API
app.use('/api', (err, req, res, next) => { // Only apply error handler to /api paths
  console.error("API Global Error Handler:", err.stack);
  res.status(err.status || 500).json({
      message: err.message || 'Internal Server Error',
      // Optionally include stack trace in development
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
});


// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
  // Verify essential environment variables on startup
  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
      console.warn("WARNING: Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) might be missing in .env");
  }
   if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-super-secret-and-strong-jwt-secret-key') {
      console.warn("SECURITY WARNING: JWT_SECRET is missing or using the default placeholder in .env. Please set a strong secret.");
   }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
       console.warn("WARNING: SUPABASE_SERVICE_ROLE_KEY is missing in .env. Admin operations might fail.");
    }
});
