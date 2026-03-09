import { generate } from "../services/gemini.service.js";
import { SYSTEM_PROMPT } from "../prompts/system.prompt.js";
import { buildClarificationPrompt } from "../prompts/clarification.prompt.js";
import { buildPlanningPrompt } from "../prompts/planning.prompt.js";
import { buildRefinementPrompt } from "../prompts/refinement.prompt.js";
import { buildSummarizationPrompt } from "../prompts/summarization.prompt.js";
import { CLARIFICATION_SCHEMA } from "../schemas/clarification.schema.js";
import { PLANNING_SCHEMA } from "../schemas/planning.schema.js";
import { REFINEMENT_SCHEMA } from "../schemas/refinement.schema.js";
import { logAgentDecision, logSummarization, logSummarizationCheck } from "../config/logger.js";

const IS_DEV = process.env.NODE_ENV === 'development';
const MAX_SESSION_TOKENS = IS_DEV ? 50000 : 100000; //Update to 10000 tokens when in local dev mode
const SUMMARIZATION_THRESHOLD = IS_DEV ? 0.1 : 0.7; //Update to 0.15 % when in local dev mode
const KEEP_RECENT_MESSAGES = 5;

export async function run(session, userMessage, modeEmitter = null) {
  session.messages.push({ role: "user", content: userMessage });

  // Check if planning has been completed - if so, enter refinement mode
  if (session.checklist && session.checklist.length > 0) {
    if (modeEmitter) modeEmitter('refinement');
    return await handleRefinement(session, modeEmitter);
  }

  // Step 1: Clarification Gate
  if (modeEmitter) modeEmitter('clarification');
  const clarificationPrompt = buildClarificationPrompt(session);

  const clarification = await generate({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: clarificationPrompt,
    responseSchema: CLARIFICATION_SCHEMA
  });

  const clarificationTokens = clarification.usage?.totalTokenCount || 0;
  session.totalTokens += clarificationTokens;
  session.tokensSinceLastSummarization = (session.tokensSinceLastSummarization || 0) + clarificationTokens;

  if (session.totalTokens > MAX_SESSION_TOKENS) {
    return {
      agentMessage:
        "This session has reached its limit. Please start a new session.",
      usage: calculateUsageMetrics(session)
    };
  }

  const clarificationData = clarification.json;

  if (clarificationData.needsClarification) {
    logAgentDecision({
      sessionId: session.id,
      decision: 'clarification',
      needsClarification: true,
      hasChecklist: false,
      tokenUsage: session.totalTokens,
      clarificationTokens,
      hasModeEmitter: !!modeEmitter
    });

    const agentMessage = clarificationData.questions.join("\n");
    session.messages.push({ role: "assistant", content: agentMessage });
    
    // Check if we need to summarize after this interaction
    if (shouldSummarize(session)) {
      await summarizeOlderMessages(session);
    }
    
    return {
      agentMessage,
      usage: calculateUsageMetrics(session)
    };
  }

  // Step 2: Planning
  if (modeEmitter) modeEmitter('planning');
  const planningPrompt = buildPlanningPrompt(session);

  const planning = await generate({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: planningPrompt,
    responseSchema: PLANNING_SCHEMA
  });

  // Track actual token usage from API
  const planningTokens = planning.usage?.totalTokenCount || 0;
  session.totalTokens += planningTokens;
  session.tokensSinceLastSummarization = (session.tokensSinceLastSummarization || 0) + planningTokens;

  if (session.totalTokens > MAX_SESSION_TOKENS) {
    return {
      agentMessage:
        "This session has reached its limit. Please start a new session.",
      usage: calculateUsageMetrics(session)
    };
  }

  const planningData = planning.json;

  if (planningData?.checklist && planningData.checklist.length > 0) {
    logAgentDecision({
      sessionId: session.id,
      decision: 'planning',
      needsClarification: false,
      hasChecklist: true,
      tokenUsage: session.totalTokens,
      clarificationTokens,
      planningTokens,
      hasModeEmitter: !!modeEmitter
    });

    session.checklist = planningData.checklist;

    const agentMessage = "Here's your checklist! Ask me additional questions if you would like me to refine it.";
    session.messages.push({ role: "assistant", content: agentMessage });
    
    // Check if we need to summarize after this interaction
    if (shouldSummarize(session)) {
      await summarizeOlderMessages(session);
    }
    
    return {
      agentMessage,
      checklist: planningData.checklist,
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
    planningTokens,
    hasModeEmitter: !!modeEmitter
  });

  session.messages.push({ role: "assistant", content: planning.text });
  
  // Check if we need to summarize after this interaction
  if (shouldSummarize(session)) {
    await summarizeOlderMessages(session);
  }
  
  return { 
    agentMessage: planning.text,
    usage: calculateUsageMetrics(session)
  };
}

async function handleRefinement(session, modeEmitter = null) {
  // Step: Refinement
  const refinementPrompt = buildRefinementPrompt(session);

  const refinement = await generate({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: refinementPrompt,
    responseSchema: REFINEMENT_SCHEMA
  });

  const refinementTokens = refinement.usage?.totalTokenCount || 0;
  session.totalTokens += refinementTokens;
  session.tokensSinceLastSummarization = (session.tokensSinceLastSummarization || 0) + refinementTokens;

  if (session.totalTokens > MAX_SESSION_TOKENS) {
    return {
      agentMessage:
        "This session has reached its limit. Please start a new session.",
      usage: calculateUsageMetrics(session)
    };
  }

  const refinementData = refinement.json;

  if (refinementData?.checklist && refinementData.checklist.length > 0) {
    logAgentDecision({
      sessionId: session.id,
      decision: 'refinement',
      needsClarification: false,
      hasChecklist: true,
      tokenUsage: session.totalTokens,
      refinementTokens,
      hasModeEmitter: !!modeEmitter
    });

    session.checklist = refinementData.checklist;

    const agentMessage = "I've refined your checklist based on your feedback. Let me know if you'd like any additional changes!";
    session.messages.push({ role: "assistant", content: agentMessage });
    
    // Check if we need to summarize after this interaction
    if (shouldSummarize(session)) {
      await summarizeOlderMessages(session);
    }
    
    return {
      agentMessage,
      checklist: refinementData.checklist,
      usage: calculateUsageMetrics(session)
    };
  }

  // Fallback response
  logAgentDecision({
    sessionId: session.id,
    decision: 'refinement_fallback',
    needsClarification: false,
    hasChecklist: false,
    tokenUsage: session.totalTokens,
    refinementTokens,
    hasModeEmitter: !!modeEmitter
  });

  session.messages.push({ role: "assistant", content: refinement.text });
  
  // Check if we need to summarize after this interaction
  if (shouldSummarize(session)) {
    await summarizeOlderMessages(session);
  }
  
  return { 
    agentMessage: refinement.text,
    usage: calculateUsageMetrics(session)
  };
}

function shouldSummarize(session) {
  // Don't summarize if we already have a summary and only recent messages
  const tokensSinceSummarization = session.tokensSinceLastSummarization || session.totalTokens;
  const tokenUsageRatio = tokensSinceSummarization / MAX_SESSION_TOKENS;
  const result = tokenUsageRatio >= SUMMARIZATION_THRESHOLD && session.messages.length > KEEP_RECENT_MESSAGES;
  
  // Log the check for debugging
  logSummarizationCheck({
    sessionId: session.id,
    tokensSinceSummarization,
    totalTokens: session.totalTokens,
    maxTokens: MAX_SESSION_TOKENS,
    threshold: SUMMARIZATION_THRESHOLD,
    tokenUsageRatio,
    messageCount: session.messages.length,
    keepRecentMessages: KEEP_RECENT_MESSAGES,
    shouldSummarize: result
  });
  
  return result;
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
  const tokensUsed = summary.usage?.totalTokenCount || 0;
  session.totalTokens += tokensUsed;
  session.tokensSinceLastSummarization = tokensUsed; // Reset to just the tokens used for summarization

  // Update session with summary and recent messages
  session.contextSummary = summary.text;
  session.messages = recentMessages;
  session.summarizationCount = (session.summarizationCount || 0) + 1;

  logSummarization({
    sessionId: session.id,
    messagesBeforeSummarization,
    messagesAfterSummarization: recentMessages.length,
    tokensUsed,
    summarizationCount: session.summarizationCount
  });
}

function calculateUsageMetrics(session) {
  const currentUsage = session.totalTokens / MAX_SESSION_TOKENS;
  const tokensSinceSummarization = session.tokensSinceLastSummarization || session.totalTokens;
  const currentSummarizationUsage = tokensSinceSummarization / MAX_SESSION_TOKENS;
  const summarizationTokenLimit = Math.floor(MAX_SESSION_TOKENS * SUMMARIZATION_THRESHOLD);
  
  // % remaining before summarization (based on tokens since last summarization)
  const remainingBeforeSummarization = Math.max(0, (SUMMARIZATION_THRESHOLD - currentSummarizationUsage) * 100);
  
  // % remaining before running out
  const remainingBeforeLimit = Math.max(0, (1 - currentUsage) * 100);
  
  return {
    remainingBeforeSummarization: Math.round(remainingBeforeSummarization * 10) / 10,
    remainingBeforeLimit: Math.round(remainingBeforeLimit * 10) / 10,
    currentTokens: session.totalTokens,
    maxTokens: MAX_SESSION_TOKENS,
    summarizationThreshold: summarizationTokenLimit,
    summarizationCount: session.summarizationCount || 0
  };
}