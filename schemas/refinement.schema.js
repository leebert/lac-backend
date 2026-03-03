/**
 * JSON Schema for Refinement Mode
 * Used when the agent refines an existing checklist based on user feedback
 */

import { CATEGORIES, PRIORITIES } from "./types.js";

export const REFINEMENT_SCHEMA = {
  type: "OBJECT",
  properties: {
    checklist: {
      type: "ARRAY",
      description: "Refined array of action items for the user",
      items: {
        type: "OBJECT",
        properties: {
          title: {
            type: "STRING",
            description: "Short title of the task"
          },
          description: {
            type: "STRING",
            description: "Detailed description of what needs to be done"
          },
          category: {
            type: "STRING",
            description: "Category of the task",
            enum: CATEGORIES
          },
          dueDate: {
            type: "STRING",
            description: "Due date in ISO format YYYY-MM-DD",
            nullable: true
          },
          priority: {
            type: "STRING",
            description: "Priority level of the task",
            enum: PRIORITIES
          }
        },
        required: ["title", "description", "category", "priority"]
      }
    }
  },
  required: ["checklist"]
};
