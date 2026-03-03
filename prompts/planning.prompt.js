export function buildPlanningPrompt(session) {
  return `
Conversation:
${formatMessages(session.messages)}

Generate a checklist:

{
  "checklist": [
    {
      "title": "",
      "description": "",
      "category": "",
      "dueDate": "",
      "priority": ""
    }
  ]
}
`;
}

function formatMessages(messages) {
  return messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
}