export function buildClarificationPrompt(session) {
  return `
Conversation:
${formatMessages(session.messages)}

Determine if more clarification is needed.

Return JSON:
{
  "needsClarification": true/false,
  "questions": []
}
`;
}

function formatMessages(messages) {
  return messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
}