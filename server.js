// server.js
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import crypto from 'crypto'; // Explicitly import crypto

// --- Log that server.js is starting ---
console.log(`SERVER SCRIPT: Starting execution. CWD: ${process.cwd()}`);

// --- Test Crypto Module Access ---
try {
  const hash = crypto.createHash('sha256');
  hash.update('test');
  const digest = hash.digest('hex');
  console.log(`SERVER SCRIPT: Crypto module test SUCCESSFUL. SHA256 of 'test': ${digest}`);
} catch (err) {
  console.error(`SERVER SCRIPT: Crypto module test FAILED: ${err.name}: ${err.message}`);
}
// ----------------------------------

// --- HARDCODE THE SECRET FOR TESTING ---
const RAW_JWT_SECRET_STRING = "vWe6xnbK4lchoCEtf6i7pUnCsSqynhyH/2yxX3OaynDBRsZBlU3KENa4DhMDkdTzFzjyEM676foUt16P+SDqkw=="; // <<< PASTE YOUR EXACT SECRET HERE
console.log(`SERVER SCRIPT: Using HARDCODED RAW JWT_SECRET string (length: ${RAW_JWT_SECRET_STRING.length}) for jsonwebtoken verification test.`);
// ------------------------------------------------------

// Import routes AFTER logging the check
import authRoutes from './src/backend/routes/authRoutes.js';
import profileRoutes from './src/backend/routes/profileRoutes.js';
import companyRoutes from './src/backend/routes/companyRoutes.js';
import userRoutes from './src/backend/routes/userRoutes.js';
import licenseRoutes from './src/backend/routes/licenseRoutes.js';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001; // Use port from env or default to 3001

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/licenses', licenseRoutes);

// --- Modified Health Check for JWT Verification Test ---
app.get('/api/health', (req, res) => { // No longer need async
  console.log("--- HEALTH CHECK JWT VERIFY TEST (jsonwebtoken only) ---");
  // Use the exact token from your successful jwt.io test and curl command
  const testToken = "eyJhbGciOiJIUzI1NiIsImtpZCI6ImpsOStzMU5uUFUvbDJkdnQiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2J1bnBrbWJsYXhiaGFsc256ZW5uLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJkMGY5NjY2MS1lMzhhLTRlNmUtYmI1MC1kMDRlNzQ1ZGIzZDYiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzQzNzcxNzUxLCJpYXQiOjE3NDM3NjgxNTEsImVtYWlsIjoiZ2xvYmFsYWRtaW5AZXN0aW1hdGUuZGl5IiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyc3RfbmFtZSI6Ikdsb2JhbCIsImxhc3RfbmFtZSI6IkFkbWluIiwicm9sZSI6Imdsb2JhbF9hZG1pbiJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzQzNzY4MTUxfV0sInNlc3Npb25faWQiOiIwZWUwZTMwZS0zYTY0LTQyZTctYWVkYS02NmI2YTJhMmJmYjUiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.vxpdmlYfSOkitNffHxGokQy7abN7wxaTJPd154_NC9w";

  // --- jsonwebtoken Test ---
  let jwtVerifyResult = "pending";
  let jwtDecodedPayload = null;
  let jwtErrorMsg = null;
  try {
    console.log(`Health Check (jsonwebtoken): Verifying token (length: ${testToken.length})`);
    console.log(`Health Check (jsonwebtoken): Using HARDCODED secret string (length: ${RAW_JWT_SECRET_STRING.length})`);
    // Verify using the raw Base64 string and explicitly specify HS256
    jwtDecodedPayload = jwt.verify(testToken, RAW_JWT_SECRET_STRING, { algorithms: ['HS256'] });
    jwtVerifyResult = "success";
    console.log("Health Check (jsonwebtoken): Verification SUCCESSFUL!");
  } catch (err) {
    jwtVerifyResult = "failed";
    jwtErrorMsg = `${err.name}: ${err.message}`;
    console.error(`Health Check (jsonwebtoken): Verification FAILED: ${jwtErrorMsg}`);
    if (err.message === 'invalid signature') {
        console.error("Health Check (jsonwebtoken): CONFIRMED INVALID SIGNATURE with jsonwebtoken library.");
    }
  }

  console.log("--- END HEALTH CHECK JWT VERIFY TEST ---");

  res.status(200).json({
      status: 'EstiMate API is running!',
      token_used_length: testToken.length,
      secret_string_used_length: RAW_JWT_SECRET_STRING.length,
      verification_tests: {
          jsonwebtoken: {
              result: jwtVerifyResult,
              error: jwtErrorMsg,
              decoded_sub: jwtVerifyResult === 'success' ? jwtDecodedPayload?.sub : null
          }
          // Removed jose test result
      }
  });
});


// --- Error Handling ---
app.use('/api/*', (req, res, next) => {
  res.status(404).json({ message: 'API Endpoint Not Found' });
});
app.use('/api', (err, req, res, next) => {
  console.error("API Global Error Handler:", err.stack);
  res.status(err.status || 500).json({
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
  // Verify essential environment variables on startup (still useful)
  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
      console.warn("WARNING: Supabase client environment variables might be missing.");
  }
  // Check the JWT_SECRET loaded by the middleware (still relevant)
   if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-super-secret-and-strong-jwt-secret-key') {
      console.warn("SECURITY WARNING: JWT_SECRET is missing or using a placeholder in .env for middleware.");
   } else {
      console.log("INFO: JWT_SECRET seems to be loaded from .env for middleware use.");
   }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
       console.warn("WARNING: SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations might fail.");
    }
});
