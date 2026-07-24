import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResetRelationshipInputSchema } from "../../types/index.js";
import {
  deleteRelationship,
  getOrCreateRelationship,
} from "../../db/repositories/relationshipRepository.js";
import { forget } from "../../core/memoryEngine.js";

const InputShape = {
  sessionId: z.string().default("default").describe("Session/project identifier to reset."),
  confirm: z
    .boolean()
    .default(false)
    .describe("Must be explicitly set to true to actually perform the reset."),
};

export function registerResetRelationshipTool(server: McpServer): void {
  server.tool(
    "reset_relationship",
    "Debug/testing tool: wipes all conflict history and resets Angel/Devil relationship state to defaults for a given session. Requires confirm=true.",
    InputShape,
    async (rawInput) => {
      const input = ResetRelationshipInputSchema.parse(rawInput);

      if (!input.confirm) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  reset: false,
                  message: `Reset for session "${input.sessionId}" was NOT performed. Call again with confirm: true to proceed.`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      forget(input.sessionId);
      deleteRelationship(input.sessionId);
      // Re-create so the session immediately has a valid default state again.
      const freshState = getOrCreateRelationship(input.sessionId);

      const result = {
        reset: true,
        message: `Session "${input.sessionId}" has been reset. Angel and Devil's relationship and conflict history are back to defaults.`,
        relationship: freshState,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
