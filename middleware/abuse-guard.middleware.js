// abuse-guard.middleware.js — Tier 2 burn-rate controls for LAC (plan §3.6).
//
// ESM port of the GenUI backend's abuse-guard.js, adapted for LAC:
//   - counters live under an `lac/` prefix in the SAME shared GCS bucket
//     (lac/usage/…), so no new bucket — just bucket-write IAM for LAC's SA.
//   - the kill-switch is the SHARED `controls/killswitch.json` flag (NOT
//     lac-prefixed), so the §1.3 budget kill-switch stops BOTH apps at once.
//   - rate-limits per IP AND per session, because LAC is session-based and a
//     single session can fan out many LLM calls (clarify → plan → refine → …).
//
// Failure policy: FAIL OPEN. Tier 1 (max-instances, the project-wide API quota,
// the budget kill-switch) is the hard ceiling, so a GCS blip can't run up a bill.

import crypto from 'crypto';
import { Storage } from '@google-cloud/storage';
import logger from '../config/logger.js';

// --- Config (values are 👤 You / secrets; referenced by name here) ----------
const DAILY_CAP = Number(process.env.DAILY_CAP) || 200;
const PER_IP_DAILY_CAP = Number(process.env.PER_IP_DAILY_CAP) || 30;
// Per-session cap (HTTP messages per session/day). Optional override; defaults
// generously since each message can be a legit multi-step agent turn.
const PER_SESSION_DAILY_CAP = Number(process.env.PER_SESSION_DAILY_CAP) || 50;
const IP_SALT = process.env.IP_SALT || '';

const PREFIX = 'lac/usage';                       // LAC counters, separate from GenUI
const KILLSWITCH_PATH = 'controls/killswitch.json'; // SHARED with GenUI (§1.3/§1.4)
const KILLSWITCH_TTL_MS = 30_000;

// Enforce only where GCS creds + a bucket exist (Cloud Run). Local dev is a
// no-op pass-through so it never pollutes prod counters — set ABUSE_GUARD_LOCAL=1
// to force it on for testing.
const IS_CLOUD_RUN = !!(process.env.K_SERVICE || process.env.FUNCTION_TARGET);
const ENFORCE = IS_CLOUD_RUN || process.env.ABUSE_GUARD_LOCAL === '1';

let _bucket = null;
function bucket() {
  if (!_bucket) _bucket = new Storage().bucket(process.env.GCS_BUCKET_NAME);
  return _bucket;
}

// --- GCS as an atomic counter (CAS via generation preconditions) — plan §2.1 -

async function readJson(path) {
  const file = bucket().file(path);
  try {
    const [buf] = await file.download();
    let generation = file.metadata && file.metadata.generation;
    if (!generation) {
      const [md] = await file.getMetadata();
      generation = md.generation;
    }
    return { data: JSON.parse(buf.toString('utf8')), generation };
  } catch (e) {
    if (e.code === 404) return { data: null, generation: 0 }; // 0 ⇒ "create only if absent"
    throw e;
  }
}

async function writeJsonCAS(path, data, generation) {
  await bucket().file(path).save(JSON.stringify(data), {
    contentType: 'application/json',
    resumable: false,
    preconditionOpts: { ifGenerationMatch: Number(generation) },
  });
}

// Atomic increment with bounded retries. Returns the new value, or null if
// `max` would be exceeded.
async function bumpCounter(path, max, retries = 8) {
  for (let i = 0; i < retries; i++) {
    const { data, generation } = await readJson(path);
    const count = (data?.count ?? 0) + 1;
    if (count > max) return null;
    try {
      await writeJsonCAS(path, { count }, generation);
      return count;
    } catch (e) {
      if (e.code === 412) continue; // lost the CAS race — retry
      throw e;
    }
  }
  throw new Error(`counter contention: retries exhausted for ${path}`);
}

// --- Shared kill-switch (plan §1.4), cached in-process ~30s ----------------

let _killCache = { value: false, at: 0 };
async function isKilled() {
  const now = Date.now();
  if (now - _killCache.at < KILLSWITCH_TTL_MS) return _killCache.value;
  try {
    const { data } = await readJson(KILLSWITCH_PATH);
    _killCache = { value: data?.disabled === true, at: now };
  } catch (e) {
    logger.error({ message: `killswitch read error (failing open): ${e.message}`, category: 'ABUSE_GUARD' });
    _killCache = { value: false, at: now };
  }
  return _killCache.value;
}

// --- Identity helpers ------------------------------------------------------

function ipHash(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return crypto.createHash('sha256').update(ip + IP_SALT).digest('hex').slice(0, 32);
}

function sessionKey(req) {
  const sid = req.body && req.body.sessionId;
  if (!sid) return null; // first message creates the session server-side — nothing to key yet
  return String(sid).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

// Fast-path: skip GCS once today's global cap is known hit (plan §2.2).
let _globalCapCache = { date: null, reached: false };

// --- The middleware — plan §2.4 / §3.6 -------------------------------------

export async function abuseGuard(req, res, next) {
  if (!ENFORCE) return next();
  try {
    if (await isKilled()) {
      return res.status(503).json({ error: 'The demo is temporarily unavailable. Check back soon.' });
    }

    const today = new Date().toISOString().slice(0, 10); // server UTC

    if (_globalCapCache.date === today && _globalCapCache.reached) {
      return res.status(429).json({ error: "The demo hit today's limit. Check back tomorrow." });
    }

    // per-IP daily cap
    if ((await bumpCounter(`${PREFIX}/ip/${today}/${ipHash(req)}.json`, PER_IP_DAILY_CAP)) === null) {
      return res.status(429).json({ error: 'Rate limit reached. Try again later.' });
    }

    // per-session daily cap (only once a session exists)
    const sid = sessionKey(req);
    if (sid && (await bumpCounter(`${PREFIX}/session/${today}/${sid}.json`, PER_SESSION_DAILY_CAP)) === null) {
      return res.status(429).json({ error: 'This session hit its limit. Start a new session or try again later.' });
    }

    // global daily cap
    if ((await bumpCounter(`${PREFIX}/daily/${today}.json`, DAILY_CAP)) === null) {
      _globalCapCache = { date: today, reached: true };
      return res.status(429).json({ error: "The demo hit today's limit. Check back tomorrow." });
    }

    next();
  } catch (e) {
    logger.error({ message: `abuseGuard error (failing open): ${e.message}`, category: 'ABUSE_GUARD', stack: e.stack });
    next(); // fail open — Tier 1 is the hard backstop (plan §2.6)
  }
}

export { bumpCounter, isKilled, ipHash, DAILY_CAP, PER_IP_DAILY_CAP, PER_SESSION_DAILY_CAP };
