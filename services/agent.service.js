import * as lifeAdminAgent from "../agents/lac.agent.js";
import * as sessionService from "./session.service.js";
import logger from "../config/logger.js";

export async function handleMessage(session, userMessage) {
  // Handle test messages for frontend testing
  if (userMessage.trim().toUpperCase() === 'TEST CLARIFICATION') {
    return {
      agentMessage: "I need some clarification before I can help you:\n\n1. What is your preferred date for this task?\n2. Do you have any budget constraints?\n3. Would you like me to include reminders?",
      usage: {
        remainingBeforeSummarization: 95.5,
        remainingBeforeLimit: 99.0,
        currentTokens: 1000,
        maxTokens: 100000,
        summarizationThreshold: 70000
      }
    };
  }

  if (userMessage.trim().toUpperCase() === 'TEST PLANNING') {
    return {
      agentMessage: "Here's your checklist! Ask me additional questions if you would like me to refine it.",
      checklist: [
        {
          title: "Schedule doctor's appointment",
          description: "Call primary care physician and schedule annual checkup",
          category: "health",
          dueDate: "2026-03-15",
          priority: "high"
        },
        {
          title: "Review credit card statements",
          description: "Check last month's expenses and ensure all charges are legitimate",
          category: "finance",
          dueDate: "2026-03-10",
          priority: "medium"
        },
        {
          title: "Book flight tickets",
          description: "Research and book flights for summer vacation",
          category: "travel",
          dueDate: "2026-04-01",
          priority: "low"
        }
      ],
      usage: {
        remainingBeforeSummarization: 92.3,
        remainingBeforeLimit: 97.5,
        currentTokens: 2500,
        maxTokens: 100000,
        summarizationThreshold: 70000
      }
    };
  }

  if (userMessage.trim().toUpperCase() === 'TEST REFINEMENT') {
    return {
      agentMessage: "I've refined your checklist based on your feedback. Let me know if you'd like any additional changes!",
      checklist: [
        {
          title: "Schedule doctor's appointment",
          description: "Call primary care physician and schedule annual checkup for early morning slot",
          category: "health",
          dueDate: "2026-03-12",
          priority: "high"
        },
        {
          title: "Review credit card statements",
          description: "Check last month's expenses and ensure all charges are legitimate",
          category: "finance",
          dueDate: "2026-03-10",
          priority: "medium"
        },
        {
          title: "Compare flight prices",
          description: "Research and compare flight prices across multiple airlines for summer vacation",
          category: "travel",
          dueDate: "2026-03-25",
          priority: "medium"
        },
        {
          title: "Book hotel accommodation",
          description: "Reserve hotel for summer vacation dates",
          category: "travel",
          dueDate: "2026-04-01",
          priority: "medium"
        }
      ],
      usage: {
        remainingBeforeSummarization: 89.7,
        remainingBeforeLimit: 95.2,
        currentTokens: 4800,
        maxTokens: 100000,
        summarizationThreshold: 70000
      }
    };
  }

  if (userMessage.trim().toUpperCase() === 'TEST ERROR') {
    return {
      agentMessage: "An error occurred while processing your request. Please try again.",
      error: "This is a simulated error for frontend error handling",
      usage: {
        remainingBeforeSummarization: 95.5,
        remainingBeforeLimit: 99.0,
        currentTokens: 1000,
        maxTokens: 100000,
        summarizationThreshold: 70000
      }
    };
  }

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