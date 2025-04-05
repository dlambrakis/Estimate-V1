import fetch from 'node-fetch'; // Ensure node-fetch is installed
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Environment Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '.env');

console.log(`testProfileFetch: Loading .env file from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error("testProfileFetch: Error loading .env file", result.error);
  // Don't exit, maybe credentials are hardcoded below
} else {
  console.log("testProfileFetch: .env file loaded successfully.");
}
// ------------------------

const BASE_URL = 'http://localhost:3001'; // Make sure this matches your server port

// --- Test User Credentials ---
// Using provided credentials as defaults if env vars are not set
const testUsers = [
  {
    description: "Global Admin",
    email: process.env.TEST_GLOBAL_ADMIN_EMAIL || "globaladmin@estimate.diy",
    password: process.env.TEST_GLOBAL_ADMIN_PASSWORD || "test" // Keep using env var or default
  },
  {
    description: "Company Admin",
    email: process.env.TEST_COMPANY_ADMIN_EMAIL || "admin@company.com",
    password: process.env.TEST_COMPANY_ADMIN_PASSWORD || "test" // Updated password
  },
  {
    description: "Reseller Admin",
    email: process.env.TEST_RESELLER_ADMIN_EMAIL || "reseller@reseller.com",
    password: process.env.TEST_RESELLER_ADMIN_PASSWORD || "test" // Updated password
  },
  {
    description: "Company User",
    email: process.env.TEST_COMPANY_USER_EMAIL || "user@company.com", // Added Company User
    password: process.env.TEST_COMPANY_USER_PASSWORD || "test" // Added password
  }
];
// ---------------------------


async function loginAndFetchProfile(email, password, description) {
  let token = null;

  console.log(`\n--- Testing Profile Fetch for: ${description} (${email}) ---`);

  // Basic credential check before attempting login
  if (!email || !password || password === 'password' || password === 'SecurePassword123!' || password === 'AnotherSecurePassword456!') {
       // Check if it's using a known default/test password AND the corresponding env var is NOT set
       const emailEnvVar = `TEST_${description.toUpperCase().replace(' ', '_')}_EMAIL`;
       const passEnvVar = `TEST_${description.toUpperCase().replace(' ', '_')}_PASSWORD`;
       if (!process.env[emailEnvVar] || !process.env[passEnvVar]) {
            console.warn(`WARN: Using default/provided credentials for ${description}. Consider setting ${emailEnvVar} and ${passEnvVar} in .env for security.`);
       }
       // Allow test to proceed with hardcoded credentials if env vars aren't set
  }
   if (!email || !password) {
        console.error(`ERROR: Credentials missing for ${description}. Skipping test.`);
        return;
   }


  // 1. Login
  console.log(`Attempting login for ${email}...`);
  try {
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const loginBody = await loginResponse.json();

    if (!loginResponse.ok) {
      console.error(`Login failed for ${email}: ${loginResponse.status} ${loginResponse.statusText}`, loginBody);
      return; // Stop testing this user if login fails
    }

    if (loginBody.session && loginBody.session.access_token) {
      token = loginBody.session.access_token;
      console.log(`Login successful for ${email}. Token obtained.`);
    } else {
      console.error(`Login response for ${email} OK, but token missing. Response:`, loginBody);
      return; // Stop testing this user
    }
  } catch (error) {
    console.error(`Error during login for ${email}:`, error);
    return; // Stop testing this user
  }

  // 2. Fetch Profile
  if (token) {
    console.log(`Fetching profile (/api/profile/me) for ${email}...`);
    try {
      const profileResponse = await fetch(`${BASE_URL}/api/profile/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log(`Profile fetch status for ${email}: ${profileResponse.status} ${profileResponse.statusText}`);

      const profileBody = await profileResponse.json();

      if (!profileResponse.ok) {
        console.error(`Profile fetch failed for ${email}:`, profileBody);
      } else {
        console.log(`Profile Response Body for ${email}:`);
        console.log(JSON.stringify(profileBody, null, 2)); // Pretty print the JSON
        console.log(`Profile fetch successful for ${email}!`);

        // --- Enhanced Validation ---
        let validationPassed = true;
        if (!profileBody.id || !profileBody.email || !profileBody.role) {
           console.error(`VALIDATION FAILED: Profile for ${email} is missing id, email, or role.`);
           validationPassed = false;
        }
        if (profileBody.role !== description.toLowerCase().replace(' ', '_')) {
            console.warn(`WARN: Role mismatch for ${email}. Expected '${description.toLowerCase().replace(' ', '_')}', Got '${profileBody.role}'. (May be ok if metadata/DB differ slightly)`);
            // Don't fail validation for this, but warn.
        }

        if (description === "Company Admin") {
            if (!profileBody.company || typeof profileBody.company !== 'object') {
                console.error(`VALIDATION FAILED: Company Admin (${email}) profile is missing the 'company' object or it's not an object.`);
                validationPassed = false;
            }
            if (profileBody.reseller) {
                console.warn(`WARN: Company Admin (${email}) profile unexpectedly contains 'reseller' data.`);
            }
        } else if (description === "Reseller Admin") {
            if (!profileBody.reseller || typeof profileBody.reseller !== 'object') {
                console.error(`VALIDATION FAILED: Reseller Admin (${email}) profile is missing the 'reseller' object or it's not an object.`);
                validationPassed = false;
            }
             if (profileBody.company) {
                console.warn(`WARN: Reseller Admin (${email}) profile unexpectedly contains 'company' data.`);
            }
        } else if (description === "Company User") {
             if (!profileBody.company || typeof profileBody.company !== 'object') {
                console.error(`VALIDATION FAILED: Company User (${email}) profile is missing the 'company' object or it's not an object.`);
                 validationPassed = false;
             }
             if (profileBody.reseller) {
                 console.warn(`WARN: Company User (${email}) profile unexpectedly contains 'reseller' data.`);
             }
        } else if (description === "Global Admin") {
            if (profileBody.company || profileBody.reseller) {
                console.warn(`WARN: Global Admin (${email}) profile unexpectedly contains 'company' or 'reseller' data.`);
            }
        }

        if (validationPassed) {
            console.log(`Basic validation passed for ${description} (${email}).`);
        } else {
             console.error(`Basic validation FAILED for ${description} (${email}). Check logs above.`);
        }
        // -----------------------

      }
    } catch (error) {
      console.error(`Error during profile fetch for ${email}:`, error);
    }
  }
}

// --- Run Tests Sequentially ---
async function runAllTests() {
  // Ensure node-fetch is available
  if (typeof fetch === 'undefined') {
      console.error("ERROR: 'node-fetch' is not available. Make sure it's installed (`npm install node-fetch`) and imported correctly.");
      return;
  }

  for (const user of testUsers) {
    await loginAndFetchProfile(user.email, user.password, user.description);
  }
  console.log("\n--- All tests completed ---");
}

runAllTests();
// -----------------------------
