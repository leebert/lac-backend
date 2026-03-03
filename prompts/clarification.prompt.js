export function buildClarificationPrompt(session) {
  return `
Conversation:
${formatMessages(session.messages)}

Determine if more clarification is needed before creating a checklist.

If clarification is needed:
- Set needsClarification to true
- Provide specific questions that would help you create a better action plan
- Ask about missing details like dates, preferences, constraints, or priorities
- Avoid asking for personal or sensitive information

If enough information is available:
- Set needsClarification to false
- Return empty questions array
`;
}

function formatMessages(messages) {
  return messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
}