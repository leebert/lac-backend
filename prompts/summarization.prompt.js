export function buildSummarizationPrompt(messages) {
  const conversation = messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n");

  return `Summarize the following conversation for planning purposes.
Keep:
- life events
- deadlines
- constraints
- preferences

Remove small talk.
Return plain text summary.

Conversation:
${conversation}`;
}
