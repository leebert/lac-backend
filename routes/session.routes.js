import express from "express";
import { handleMessage, handleMessageSSE } from "../controllers/session.controller.js";
import { authenticate } from "../controllers/auth.controller.js";
import { authenticateJWT } from "../middleware/auth.middleware.js";
import { abuseGuard } from "../middleware/abuse-guard.middleware.js";

const router = express.Router();

// Public auth endpoint (Turnstile verify → JWT)
router.post("/auth", authenticate);

// Protected message endpoints. Order: JWT → abuseGuard (rate/kill-switch) →
// handler, so a request that trips a cap never reaches Gemini (plan §2.4/§3.6).
router.post("/message", authenticateJWT, abuseGuard, handleMessage);
router.post("/message-stream", authenticateJWT, abuseGuard, handleMessageSSE);

export default router;