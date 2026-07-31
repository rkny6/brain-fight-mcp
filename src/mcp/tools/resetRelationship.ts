import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  DEFAULT_TOPIC_DOMAIN,
  ResetRelationshipInputSchema,
  TopicDomainSchema,
} from "../../types/index.js";
import {
  deleteRelationship,
  getOrCreateRelationship,
} from "../../db/repositories/relationshipRepository.js";
import { forget } from "../../core/memoryEngine.js";
import { deleteActiveConflictsForSession } from "../../db/repositories/activeConflictRepository.js";

const InputShape = {
  sessionId: z.string().default("default").describe("Session/project identifier to reset."),
  domain: TopicDomainSchema.optional().describe(
    "Reset just this domain's relationship/history (career | money | relationships | health | general). Omit to reset ALL domains for this session.",
  ),
  confirm: z
    .boolean()
    .default(false)
    .describe("Must be explicitly set to true to actually perform the reset."),
};

export function registerResetRelationshipTool(server: McpServer): void {
  server.tool(
    "reset_relationship",
    "Debug/testing tool: wipes conflict history, recorded decision outcomes, open turn-mode debates, and resets Angel/Devil relationship state to defaults for a given session — scoped to one domain if given, otherwise every domain. Requires confirm=true.",
    InputShape,
    async (rawInput) => {
      const input = ResetRelationshipInputSchema.parse(rawInput);
      const scopeLabel = input.domain ? `domain "${input.domain}" of ` : "ALL domains of ";

      if (!input.confirm) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  reset: false,
                  message: `Reset for ${scopeLabel}session "${input.sessionId}" was NOT performed. Call again with confirm: true to proceed.`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      forget(input.sessionId, input.domain);
      deleteActiveConflictsForSession(input.sessionId, input.domain);
      deleteRelationship(input.sessionId, input.domain);
      // Re-create so the (session, domain) immediately has a valid default state again.
      const freshState = getOrCreateRelationship(
        input.sessionId,
        input.domain ?? DEFAULT_TOPIC_DOMAIN,
      );

      const result = {
        reset: true,
        message: `${scopeLabel}session "${input.sessionId}" has been reset. Relationship, conflict history, and any open turn debates are back to defaults.`,
        relationship: freshState,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
