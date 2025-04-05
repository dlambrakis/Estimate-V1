// test-dotenv.js
import dotenv from 'dotenv';

console.log(`TEST SCRIPT: Current Working Directory: ${process.cwd()}`);

// Attempt to load .env file
const result = dotenv.config();

console.log("TEST SCRIPT: dotenv.config() result:", result);

// Check specific variables
console.log(`TEST SCRIPT: process.env.JWT_SECRET: ${process.env.JWT_SECRET ? process.env.JWT_SECRET.substring(0, 5) + '...' + process.env.JWT_SECRET.slice(-5) : 'NOT FOUND'}`);
console.log(`TEST SCRIPT: process.env.VITE_SUPABASE_URL: ${process.env.VITE_SUPABASE_URL || 'NOT FOUND'}`);
console.log(`TEST SCRIPT: process.env.PORT: ${process.env.PORT || 'NOT FOUND'}`);

if (result.error) {
  console.error("TEST SCRIPT: Error loading .env file:", result.error);
} else if (!result.parsed || Object.keys(result.parsed).length === 0) {
  console.warn("TEST SCRIPT: .env file loaded, but it seems empty or no variables were parsed.");
} else {
  console.log("TEST SCRIPT: Successfully loaded and parsed .env file.");
}
