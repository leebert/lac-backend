import jwt from 'jsonwebtoken';
import { logError } from '../config/logger.js';

const TOKEN_EXPIRY = '4h';

export async function authenticate(req, res) {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Read environment variables at runtime
    const LAC_PASSWORD = process.env.LAC_PASSWORD;
    const JWT_SECRET = process.env.JWT_SECRET;

    if (!LAC_PASSWORD) {
      logError({
        error: new Error('LAC_PASSWORD not configured'),
        endpoint: '/api/auth',
        errorType: 'ConfigurationError'
      });
      return res.status(500).json({ error: 'Authentication not configured' });
    }

    if (!JWT_SECRET) {
      logError({
        error: new Error('JWT_SECRET not configured'),
        endpoint: '/api/auth',
        errorType: 'ConfigurationError'
      });
      return res.status(500).json({ error: 'Authentication not configured' });
    }

    if (password !== LAC_PASSWORD) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { authenticated: true },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    // Calculate expiry time in seconds (4 hours = 14400 seconds)
    const expiresIn = 4 * 60 * 60;

    res.json({
      token,
      expiresIn
    });
  } catch (err) {
    logError({
      error: err,
      endpoint: '/api/auth',
      errorType: err.name || 'UnknownError'
    });
    res.status(500).json({ error: 'Authentication failed' });
  }
}
