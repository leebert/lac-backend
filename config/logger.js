import winston from 'winston';

const { combine, timestamp, printf, json, colorize } = winston.format;

// Custom format for different log categories with visual separators
const categoryFormat = printf(({ level, message, timestamp, category, ...metadata }) => {
  const categoryPrefix = category ? `[${category}]` : '';
  const separator = '═'.repeat(80);
  
  // Format metadata nicely
  const metaStr = Object.keys(metadata).length 
    ? '\n' + JSON.stringify(metadata, null, 2)
    : '';
  
  return `${timestamp} ${level}: ${categoryPrefix} ${message}${metaStr}`;
});

// Console format with colors for local development
const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  categoryFormat
);

// JSON format for production (structured logging)
const jsonFormat = combine(
  timestamp(),
  json()
);

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production' || 
                     process.env.K_SERVICE || 
                     process.env.FUNCTION_TARGET;

// Create the Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: isProduction ? jsonFormat : consoleFormat,
  defaultMeta: { service: 'life-admin-copilot' },
  transports: [
    new winston.transports.Console()
  ]
});

// Category-specific logging functions with structured metadata

/**
 * Log HTTP request metrics
 */
export function logRequest({ method, path, statusCode, duration, sessionId, error }) {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  
  logger.log({
    level,
    message: `${method} ${path} ${statusCode} - ${duration}ms`,
    category: 'REQUEST_METRICS',
    method,
    path,
    statusCode,
    duration,
    sessionId,
    error: error?.message
  });
}

/**
 * Log agent decision points
 */
export function logAgentDecision({ 
  sessionId, 
  decision, 
  needsClarification, 
  hasChecklist, 
  tokenUsage,
  clarificationTokens,
  planningTokens 
}) {
  logger.info({
    message: `Agent decision: ${decision}`,
    category: 'AGENT_DECISION',
    sessionId,
    decision,
    needsClarification,
    hasChecklist,
    tokenUsage,
    clarificationTokens,
    planningTokens
  });
}

/**
 * Log API calls to external services (Gemini)
 */
export function logApiCall({ 
  service, 
  operation, 
  duration, 
  tokenCount, 
  promptTokens,
  candidatesTokens,
  totalTokens,
  error,
  model 
}) {
  const level = error ? 'error' : 'info';
  
  logger.log({
    level,
    message: `${service} API: ${operation} - ${duration}ms`,
    category: 'API_CALL',
    service,
    operation,
    duration,
    tokenCount,
    promptTokens,
    candidatesTokens,
    totalTokens,
    model,
    error: error?.message,
    errorStack: error?.stack
  });
}

/**
 * Log session lifecycle events
 */
export function logSessionLifecycle({ 
  event, 
  sessionId, 
  messageCount, 
  totalTokens,
  checklistCount,
  duration 
}) {
  logger.info({
    message: `Session ${event}: ${sessionId}`,
    category: 'SESSION_LIFECYCLE',
    event,
    sessionId,
    messageCount,
    totalTokens,
    checklistCount,
    duration
  });
}

/**
 * Log session summarization events
 */
export function logSummarization({ 
  sessionId, 
  messagesBeforeSummarization,
  messagesAfterSummarization,
  tokensUsed,
  summarizationCount
}) {
  logger.info({
    message: `Session summarized: ${sessionId} (count: ${summarizationCount})`,
    category: 'SESSION_LIFECYCLE',
    event: 'summarization',
    sessionId,
    messagesBeforeSummarization,
    messagesAfterSummarization,
    tokensUsed,
    summarizationCount
  });
}

/**
 * Log summarization check details for debugging
 */
export function logSummarizationCheck({ 
  sessionId,
  tokensSinceSummarization,
  totalTokens,
  maxTokens,
  threshold,
  tokenUsageRatio,
  messageCount,
  keepRecentMessages,
  shouldSummarize
}) {
  logger.info({
    message: `Summarization check: ${shouldSummarize ? 'TRIGGERED' : 'SKIPPED'}`,
    category: 'SUMMARIZATION_CHECK',
    sessionId,
    tokensSinceSummarization,
    totalTokens,
    maxTokens,
    threshold,
    tokenUsageRatio: Math.round(tokenUsageRatio * 1000) / 10 + '%',
    thresholdPercentage: Math.round(threshold * 100) + '%',
    messageCount,
    keepRecentMessages,
    shouldSummarize,
    reason: shouldSummarize 
      ? 'Token threshold exceeded and enough messages'
      : tokenUsageRatio < threshold 
        ? `Token usage (${Math.round(tokenUsageRatio * 1000) / 10}%) below threshold (${Math.round(threshold * 100)}%)`
        : `Not enough messages (${messageCount} <= ${keepRecentMessages})`
  });
}

/**
 * Log errors with categorization
 */
export function logError({ 
  error, 
  endpoint, 
  errorType, 
  sessionId, 
  context 
}) {
  logger.error({
    message: error.message,
    category: 'ERROR',
    endpoint,
    errorType: errorType || error.name,
    sessionId,
    context,
    stack: error.stack
  });
}

/**
 * Generic logger for other use cases
 */
export default logger;
