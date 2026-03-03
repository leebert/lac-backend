export function buildPlanningPrompt(session) {
  return `
Conversation:
${formatMessages(session.messages)}

Generate a comprehensive checklist of action items.

For each item:
- title: Short, clear title (2-5 words)
- description: Detailed explanation of what needs to be done
- category: Choose from: health, finance, travel, household, work, personal
- dueDate: If a specific date was mentioned, use ISO format YYYY-MM-DD, otherwise null
- priority: Assess as low, medium, or high based on urgency and importance

Break down complex tasks into smaller, actionable steps.
Order items by priority and logical sequence.
`;
}

function formatMessages(messages) {
  return messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
}