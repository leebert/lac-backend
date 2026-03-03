import * as sessionService from "../services/session.service.js";
import * as agentService from "../services/agent.service.js";
import { logError } from "../config/logger.js";

export async function handleMessage(req, res) {
  try {
    const { sessionId, message } = req.body;

    if (!message) {
      const error = new Error("Message is required");
      logError({
        error,
        endpoint: '/api/message',
        errorType: 'ValidationError',
        sessionId,
        context: { body: req.body }
      });
      return res.status(400).json({ error: "Message is required" });
    }

    // Get existing session or create new one
    let session;
    if (sessionId) {
      session = await sessionService.get(sessionId);
      if (!session) {
        const error = new Error("Session not found");
        logError({
          error,
          endpoint: '/api/message',
          errorType: 'NotFoundError',
          sessionId,
          context: { requestedSessionId: sessionId }
        });
        return res.status(404).json({ error: "Session not found" });
      }
    } else {
      session = await sessionService.create();
    }

    // Process the message
    const agentResponse = await agentService.handleMessage(session, message);

    res.json({
      sessionId: session.id,
      ...agentResponse
    });
  } catch (err) {
    logError({
      error: err,
      endpoint: '/api/message',
      errorType: err.name || 'UnknownError',
      sessionId: req.body?.sessionId,
      context: {
        message: req.body?.message,
        hasSessionId: !!req.body?.sessionId
      }
    });
    
    res.locals.error = err;
    res.status(500).json({ error: "Failed to process message" });
  }
}