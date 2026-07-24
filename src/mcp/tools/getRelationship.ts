import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GetRelationshipInputSchema } from "../../types/index.js";
import { getOrCreateRelationship } from "../../db/repositories/relationshipRepository.js";
import { recall } from "../../core/memoryEngine.js";

const InputShape = {
  sessionId: z.string().default("default").describe("Session/project identifier for state isolation."),
};

export function registerGetRelationshipTool(server: McpServer): void {
  server.tool(
    "get_relationship",
    "Returns the current Angel/Devil relationship state (respect, annoyance, cooperation) for a session, plus recent conflict history.",
    InputShape,
    async (rawInput) => {
      const input = GetRelationshipInputSchema.parse(rawInput);
      const relationship = getOrCreateRelationship(input.sessionId);
      const recentMemory = recall(input.sessionId, 5);

      const result = {
        relationship,
        recent_memory: recentMemory,
        performance_instructions:
          "If the user is asking about the relationship out of curiosity, describe it in-character — Angel and Devil can briefly comment on their own dynamic (e.g. grudging respect, simmering annoyance, surprising cooperation) rather than reading out raw numbers.",
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
