import jwt from 'jsonwebtoken';
import crypto from 'crypto'; // Import crypto

// --- Use the EXACT SAME hardcoded values ---
const testToken = "eyJhbGciOiJIUzI1NiIsImtpZCI6ImpsOStzMU5uUFUvbDJkdnQiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2J1bnBrbWJsYXhiaGFsc256ZW5uLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJkMGY5NjY2MS1lMzhhLTRlNmUtYmI1MC1kMDRlNzQ1ZGIzZDYiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzQzNzcxNzUxLCJpYXQiOjE3NDM3NjgxNTEsImVtYWlsIjoiZ2xvYmFsYWRtaW5AZXN0aW1hdGUuZGl5IiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyc3RfbmFtZSI6Ikdsb2JhbCIsImxhc3RfbmFtZSI6IkFkbWluIiwicm9sZSI6Imdsb2JhbF9hZG1pbiJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzQzNzY4MTUxfV0sInNlc3Npb25faWQiOiIwZWUwZTMwZS0zYTY0LTQyZTctYWVkYS02NmI2YTJhMmJmYjUiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.vxpdmlYfSOkitNffHxGokQy7abN7wxaTJPd154_NC9w";
const RAW_JWT_SECRET_STRING = "vWe6xnbK4lchoCEtf6i7pUnCsSqynhyH/2yxX3OaynDBRsZBlU3KENa4DhMDkdTzFzjyEM676foUt16P+SDqkw==";

console.log("--- Standalone JWT Verification Test ---");
console.log(`Node.js version: ${process.version}`);
// console.log(`Using jsonwebtoken version: ${jwt.version}`); // Might be undefined, less critical now
console.log(`Token length: ${testToken.length}`);
console.log(`Secret String length: ${RAW_JWT_SECRET_STRING.length}`);

// --- Test 1: jsonwebtoken.verify ---
console.log("\n--- Test 1: Using jsonwebtoken.verify ---");
try {
  console.log("Attempting jwt.verify...");
  const decoded = jwt.verify(testToken, RAW_JWT_SECRET_STRING, { algorithms: ['HS256'] });
  console.log("jsonwebtoken.verify: SUCCESSFUL!");
  console.log("Decoded Payload (sub):", decoded.sub);
} catch (err) {
  console.error(`jsonwebtoken.verify: FAILED: ${err.name}: ${err.message}`);
  if (err.message === 'invalid signature') {
      console.error("jsonwebtoken.verify: CONFIRMED INVALID SIGNATURE.");
  }
  // console.error("Stack Trace:", err.stack); // Keep it less verbose for now
}

// --- Test 2: Manual Crypto Verification ---
console.log("\n--- Test 2: Manual Crypto Verification using Node crypto ---");
try {
    const tokenParts = testToken.split('.');
    if (tokenParts.length !== 3) {
        throw new Error("Invalid JWT format: Token does not have 3 parts.");
    }
    const headerAndPayload = tokenParts[0] + '.' + tokenParts[1];
    const signatureFromToken = tokenParts[2];

    console.log("Manual Crypto: Creating HMAC SHA256...");
    const hmac = crypto.createHmac('sha256', RAW_JWT_SECRET_STRING);

    console.log("Manual Crypto: Updating HMAC with header.payload data...");
    hmac.update(headerAndPayload);

    console.log("Manual Crypto: Calculating digest (base64)...");
    const calculatedDigest = hmac.digest('base64');

    // Convert Base64 to Base64URL
    const calculatedSignature = calculatedDigest
        .replace(/\+/g, '-') // Replace + with -
        .replace(/\//g, '_') // Replace / with _
        .replace(/=+$/, ''); // Remove trailing =

    console.log(`Manual Crypto: Calculated Signature (Base64URL): ${calculatedSignature}`);
    console.log(`Manual Crypto: Signature from Token (Base64URL):   ${signatureFromToken}`);

    if (calculatedSignature === signatureFromToken) {
        console.log("Manual Crypto: VERIFICATION SUCCESSFUL! Signatures match.");
    } else {
        console.error("Manual Crypto: VERIFICATION FAILED! Signatures do NOT match.");
        // Log lengths for debugging potential subtle differences
        console.error(`Manual Crypto: Calculated length: ${calculatedSignature.length}, Original length: ${signatureFromToken.length}`);
    }

} catch (err) {
    console.error(`Manual Crypto: FAILED with error: ${err.name}: ${err.message}`);
    console.error("Manual Crypto Stack Trace:", err.stack);
}


console.log("\n--- End Standalone Test ---");
