import express from "express";
import { handleMessage, handleMessageSSE } from "../controllers/session.controller.js";
import { authenticate } from "../controllers/auth.controller.js";
import { authenticateJWT } from "../middleware/auth.middleware.js";

const router = express.Router();

// Public auth endpoint
router.post("/auth", authenticate);

// Protected message endpoints
router.post("/message", authenticateJWT, handleMessage);
router.post("/message-stream", authenticateJWT, handleMessageSSE);

export default router;