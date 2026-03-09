import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  parseIntentText,
  extractWorkflow,
  executeWorkflow,
} from "@intenttext/core";
import type { ToolHandler, ExecutionContext } from "@intenttext/core";
import { jsonResult } from "../types.js";

export function registerWorkflowTools(server: McpServer): void {
  server.tool(
    "extract_workflow",
    "Extract the execution graph from an IntentText workflow document. " +
      "Returns steps in topological order, dependency relationships, parallel batches, " +
      "and gate positions. Use this to understand how to execute a workflow before running it.",
    {
      source: z
        .string()
        .describe(
          "IntentText source containing workflow blocks (step:, decision:, gate:, etc.)",
        ),
    },
    async ({ source }) => {
      const doc = parseIntentText(source);
      const workflow = extractWorkflow(doc);
      return jsonResult(workflow);
    },
  );

  server.tool(
    "execute_workflow",
    "Execute a workflow defined in IntentText source. Runs steps in topological order, " +
      "evaluates decision branches, enforces gates, and records an execution log. " +
      "Provide tool implementations as a JSON map of tool-name → return-value for dry-run " +
      "simulation, or omit tools to run in dry-run mode.",
    {
      source: z
        .string()
        .describe(
          "IntentText source containing workflow blocks (step:, decision:, gate:, etc.)",
        ),
      context: z
        .record(z.unknown())
        .optional()
        .describe(
          "Initial context variables available to steps and decision conditions.",
        ),
      tool_results: z
        .record(z.unknown())
        .optional()
        .describe(
          "Map of tool name → simulated return value. " +
            "Each tool referenced by a step will return the corresponding value.",
        ),
      dry_run: z
        .boolean()
        .optional()
        .describe(
          "If true, evaluate decisions and validate but do not call tools. Default: false.",
        ),
      max_steps: z
        .number()
        .optional()
        .describe(
          "Maximum number of steps to execute (prevents runaway). Default: 1000.",
        ),
      approve_gates: z
        .boolean()
        .optional()
        .describe(
          "If true, automatically approve all gates. If false, gates block execution. Default: true.",
        ),
    },
    async ({ source, context, tool_results, dry_run, max_steps, approve_gates }) => {
      const doc = parseIntentText(source);

      // Build tool handlers from the simulated results map
      const tools: Record<string, ToolHandler> | undefined = tool_results
        ? Object.fromEntries(
            Object.entries(tool_results).map(([name, value]) => [
              name,
              () => value,
            ]),
          )
        : undefined;

      const result = await executeWorkflow(doc, {
        tools,
        context: context as Record<string, unknown> | undefined,
        onGate:
          approve_gates === false
            ? async () => false
            : async () => true,
        options: {
          dryRun: dry_run ?? false,
          maxSteps: max_steps,
        },
      });

      return jsonResult({
        status: result.status,
        context: result.context,
        log: result.log,
        error: result.error?.message,
        blockedAt: result.blockedAt
          ? { id: result.blockedAt.properties?.id, content: result.blockedAt.content }
          : undefined,
      });
    },
  );
}
