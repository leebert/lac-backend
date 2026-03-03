export function buildRefinementPrompt(session) {
  return `
Conversation:
${formatMessages(session.messages)}

Current Checklist:
${formatChecklist(session.checklist)}

The user has provided feedback on the checklist. Refine and update the checklist based on their input.

For each item in the refined checklist:
- title: Short, clear title (2-5 words)
- description: Detailed explanation of what needs to be done
- category: Choose from: health, finance, travel, household, work, personal
- dueDate: If a specific date was mentioned, use ISO format YYYY-MM-DD, otherwise null
- priority: Assess as low, medium, or high based on urgency and importance

You may:
- Add new items if the user requests them
- Remove items if the user says they're not needed
- Modify existing items based on user feedback
- Reorder items for better logical sequence
- Break down tasks further or consolidate them

Return the complete refined checklist and disregard the old checklist.
`;
}

function formatMessages(messages) {
  return messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
}

function formatChecklist(checklist) {
  if (!checklist || checklist.length === 0) {
    return "No checklist available.";
  }
  
  return checklist
    .map((item, idx) => `${idx + 1}. [${item.priority.toUpperCase()}] ${item.title}
   Category: ${item.category}
   Description: ${item.description}
   Due Date: ${item.dueDate || 'Not specified'}`)
    .join("\n\n");
}
