import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ClearDatabaseInputSchema } from "../../types/index.js";
import { clearAllState } from "../../db/repositories/databaseAdmin.js";

const InputShape = {
  confirm: z
    .boolean()
    .default(false)
    .describe(
      "Must be explicitly set to true to wipe the entire SQLite database (all sessions).",
    ),
};

export function registerClearDatabaseTool(server: McpServer): void {
  server.tool(
    "clear_database",
    "Debug/testing tool: wipes ALL sessions from the local SQLite store (relationship_state, conflicts, active_conflicts, debate_turns, decision_outcomes, relationship_milestones). Requires confirm=true. Prefer reset_relationship when you only need one sessionId.",
    InputShape,
    async (rawInput) => {
      const input = ClearDatabaseInputSchema.parse(rawInput);

      if (!input.confirm) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  cleared: false,
                  message:
                    "Database clear was NOT performed. Call again with confirm: true to wipe ALL sessions (relationship_state + conflicts + active turn debates).",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const summary = clearAllState();

      const result = {
        cleared: true,
        message:
          "SQLite state wiped for ALL sessions. relationship_state, conflicts, active_conflicts, and debate_turns are empty.",
        deleted: summary,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
