import * as lifeAdminAgent from "../agents/lac.agent.js";
import * as sessionService from "./session.service.js";
import logger from "../config/logger.js";

export async function handleMessage(session, userMessage) {
  const response = await lifeAdminAgent.run(session, userMessage);

  await sessionService.update(session);

  // Debug log: Display session state after processing
  logger.debug({
    message: 'Session state after handleMessage',
    category: 'DEBUG_SESSION_STATE',
    sessionId: session.id,
    sessionState: {
      messageCount: session.messages.length,
      totalTokens: session.totalTokens,
      checklistItems: session.checklist?.length || 0,
      hasContextSummary: !!session.contextSummary,
      contextSummaryLength: session.contextSummary?.length || 0,
      sessionAge: Date.now() - session.createdAt,
      messages: session.messages,
      checklist: session.checklist,
      contextSummary: session.contextSummary
    }
  });

  return response;
}