import { generate } from "../services/gemini.service.js";
import { SYSTEM_PROMPT } from "../prompts/system.prompt.js";
import { buildClarificationPrompt } from "../prompts/clarification.prompt.js";
import { buildPlanningPrompt } from "../prompts/planning.prompt.js";
import { buildSummarizationPrompt } from "../prompts/summarization.prompt.js";
import { logAgentDecision, logSummarization } from "../config/logger.js";

const MAX_SESSION_TOKENS = 100000;
const SUMMARIZATION_THRESHOLD = 0.7;
const KEEP_RECENT_MESSAGES = 5;

export async function run(session, userMessage) {
  session.messages.push({ role: "user", content: userMessage });

  // Check if we need to summarize
  if (shouldSummarize(session)) {
    await summarizeOlderMessages(session);
  }

  // Step 1: Clarification Gate
  const clarificationPrompt = buildClarificationPrompt(session);

  const clarification = await generate({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: clarificationPrompt
  });

  const clarificationTokens = clarification.usage?.totalTokens || 0;
  session.totalTokens += clarificationTokens;

  if (session.totalTokens > MAX_SESSION_TOKENS) {
    return {
      agentMessage:
        "This session has reached its limit. Please start a new session.",
      usage: calculateUsageMetrics(session)
    };
  }

  const clarificationJSON = safeParse(clarification.text);

  if (clarificationJSON?.needsClarification) {
    logAgentDecision({
      sessionId: session.id,
      decision: 'clarification',
      needsClarification: true,
      hasChecklist: false,
      tokenUsage: session.totalTokens,
      clarificationTokens
    });

    const agentMessage = clarificationJSON.questions.join("\n");
    session.messages.push({ role: "assistant", content: agentMessage });
    return {
      agentMessage,
      usage: calculateUsageMetrics(session)
    };
  }

  // Step 2: Planning
  const planningPrompt = buildPlanningPrompt(session);

  const planning = await generate({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: planningPrompt
  });

  // Track actual token usage from API
  const planningTokens = planning.usage?.totalTokens || 0;
  session.totalTokens += planningTokens;

  if (session.totalTokens > MAX_SESSION_TOKENS) {
    return {
      agentMessage:
        "This session has reached its limit. Please start a new session.",
      usage: calculateUsageMetrics(session)
    };
  }

  const planningJSON = safeParse(planning.text);

  if (planningJSON?.checklist) {
    logAgentDecision({
      sessionId: session.id,
      decision: 'planning',
      needsClarification: false,
      hasChecklist: true,
      tokenUsage: session.totalTokens,
      clarificationTokens,
      planningTokens
    });

    session.checklist = planningJSON.checklist;

    const agentMessage = "Here's your checklist:";
    session.messages.push({ role: "assistant", content: agentMessage });
    return {
      agentMessage,
      checklist: planningJSON.checklist,
      usage: calculateUsageMetrics(session)
    };
  }

  // Fallback response
  logAgentDecision({
    sessionId: session.id,
    decision: 'fallback',
    needsClarification: false,
    hasChecklist: false,
    tokenUsage: session.totalTokens,
    clarificationTokens,
    planningTokens
  });

  session.messages.push({ role: "assistant", content: planning.text });
  return { 
    agentMessage: planning.text,
    usage: calculateUsageMetrics(session)
  };
}

function shouldSummarize(session) {
  // Don't summarize if we already have a summary and only recent messages
  const tokenUsageRatio = session.totalTokens / MAX_SESSION_TOKENS;
  return tokenUsageRatio >= SUMMARIZATION_THRESHOLD && session.messages.length > KEEP_RECENT_MESSAGES;
}

async function summarizeOlderMessages(session) {
  // Keep the last N messages
  const recentMessages = session.messages.slice(-KEEP_RECENT_MESSAGES);
  const olderMessages = session.messages.slice(0, -KEEP_RECENT_MESSAGES);

  if (olderMessages.length === 0) {
    return;
  }

  const messagesBeforeSummarization = session.messages.length;

  // Generate summary of older messages
  const summarizationPrompt = buildSummarizationPrompt(olderMessages);
  const summary = await generate({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: summarizationPrompt
  });

  // Track actual token usage from API
  const tokensUsed = summary.usage?.totalTokens || 0;
  session.totalTokens += tokensUsed;

  // Update session with summary and recent messages
  session.contextSummary = summary.text;
  session.messages = recentMessages;

  logSummarization({
    sessionId: session.id,
    messagesBeforeSummarization,
    messagesAfterSummarization: recentMessages.length,
    tokensUsed
  });
}

function calculateUsageMetrics(session) {
  const currentUsage = session.totalTokens / MAX_SESSION_TOKENS;
  
  // % remaining before summarization
  const remainingBeforeSummarization = Math.max(0, (SUMMARIZATION_THRESHOLD - currentUsage) * 100);
  
  // % remaining before running out
  const remainingBeforeLimit = Math.max(0, (1 - currentUsage) * 100);
  
  return {
    remainingBeforeSummarization: Math.round(remainingBeforeSummarization * 10) / 10,
    remainingBeforeLimit: Math.round(remainingBeforeLimit * 10) / 10
  };
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}