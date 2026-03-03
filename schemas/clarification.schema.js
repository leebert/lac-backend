/**
 * JSON Schema for Clarification Mode
 * Used when the agent needs to ask clarifying questions
 */

export const CLARIFICATION_SCHEMA = {
  type: "OBJECT",
  properties: {
    needsClarification: {
      type: "BOOLEAN",
      description: "Whether more clarification is needed before planning"
    },
    questions: {
      type: "ARRAY",
      description: "Array of clarifying questions to ask the user",
      items: {
        type: "STRING"
      }
    }
  },
  required: ["needsClarification", "questions"]
};
