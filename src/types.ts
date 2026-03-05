import type { IntentDocument } from "@intenttext/core";

export type { IntentDocument };

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
}

export function jsonResult(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function textResult(text: string): ToolResult {
  return {
    content: [{ type: "text", text }],
  };
}
