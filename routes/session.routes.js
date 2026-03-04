import express from "express";
import { handleMessage, handleMessageSSE } from "../controllers/session.controller.js";

const router = express.Router();

router.post("/message", handleMessage);
router.post("/message-stream", handleMessageSSE);

export default router;