import jwt from 'jsonwebtoken';
import { logError } from '../config/logger.js';

const TOKEN_EXPIRY = '4h';

// Verify a Cloudflare Turnstile token, then issue a 4h JWT. Replaces the retired
// LAC_PASSWORD gate (plan §3.6). Reuses the portfolio's Turnstile widget — same
// TURNSTILE_SECRET value, LAC's domain added to the widget's allowed hostnames.
// Fails OPEN on a Cloudflare transport error/timeout (plan §3.0a): a genuine
// rejection comes back as { success:false } and is handled as a 401.
export async function authenticate(req, res) {
  try {
    const { token: turnstileToken } = req.body;

    if (!turnstileToken) {
      return res.status(400).json({ error: 'Turnstile token is required' });
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET;

    if (!JWT_SECRET || !TURNSTILE_SECRET) {
      logError({
        error: new Error('JWT_SECRET or TURNSTILE_SECRET not configured'),
        endpoint: '/api/auth',
        errorType: 'ConfigurationError'
      });
      return res.status(500).json({ error: 'Authentication not configured' });
    }

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const params = new URLSearchParams({ secret: TURNSTILE_SECRET, response: turnstileToken });
    if (ip) params.set('remoteip', ip); // omit when empty (local dev) — Cloudflare rejects a blank remoteip

    let verify;
    try {
      verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
        signal: AbortSignal.timeout(3000), // don't hang if Cloudflare is unreachable
      }).then((r) => r.json());
    } catch (e) {
      // Transport error / timeout = Cloudflare unavailable → FAIL OPEN (§3.0a).
      logError({
        error: e,
        endpoint: '/api/auth',
        errorType: 'TurnstileUnreachable'
      });
      verify = { success: true, _failedOpen: true };
    }

    if (!verify.success) {
      return res.status(401).json({ error: 'Verification failed' });
    }

    const token = jwt.sign({ authenticated: true }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    const expiresIn = 4 * 60 * 60; // seconds

    res.json({ token, expiresIn });
  } catch (err) {
    logError({
      error: err,
      endpoint: '/api/auth',
      errorType: err.name || 'UnknownError'
    });
    res.status(500).json({ error: 'Authentication failed' });
  }
}
