import { v4 as uuid } from "uuid";
import { logSessionLifecycle } from "../config/logger.js";

const sessions = new Map();

export async function create() {
  const id = uuid();

  const session = {
    id,
    createdAt: Date.now(),
    contextSummary: "",
    messages: [],
    checklist: [],
    totalTokens: 0
  };

  sessions.set(id, session);
  
  logSessionLifecycle({
    event: 'created',
    sessionId: id,
    messageCount: 0,
    totalTokens: 0,
    checklistCount: 0
  });
  
  return session;
}

export async function get(id) {
  return sessions.get(id);
}

export async function update(session) {
  sessions.set(session.id, session);
  
  const duration = Date.now() - session.createdAt;
  
  logSessionLifecycle({
    event: 'updated',
    sessionId: session.id,
    messageCount: session.messages.length,
    totalTokens: session.totalTokens,
    checklistCount: session.checklist?.length || 0,
    duration
  });
}