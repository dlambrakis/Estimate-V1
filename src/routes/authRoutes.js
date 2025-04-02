// src/routes/authRoutes.js
import express from 'express';
import { loginUser } from '../services/authService.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const result = await loginUser(email, password);

    if (result.success) {
      // Send the token and user info back to the client
      res.status(result.status).json({
        message: result.message,
        token: result.token,
        user: result.user
      });
    } else {
      res.status(result.status).json({ message: result.message });
    }
  } catch (error) {
    console.error('Login route error:', error);
    res.status(500).json({ message: 'An unexpected error occurred during login.' });
  }
});

// Example of adding a registration route later (requires more service logic)
// router.post('/register', async (req, res) => { /* ... */ });

export default router;
