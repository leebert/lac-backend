import jwt from 'jsonwebtoken';
import { logError } from '../config/logger.js';

export function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  // Read environment variable at runtime
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!JWT_SECRET) {
    logError({
      error: new Error('JWT_SECRET not configured'),
      endpoint: req.path,
      errorType: 'ConfigurationError'
    });
    return res.status(500).json({ error: 'Authentication not configured' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    logError({
      error: err,
      endpoint: req.path,
      errorType: err.name || 'UnknownError'
    });
    return res.status(401).json({ error: 'Authentication failed' });
  }
}
