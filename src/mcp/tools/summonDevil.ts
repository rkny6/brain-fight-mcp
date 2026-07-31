import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SummonInputSchema } from "../../types/index.js";
import { getProfile } from "../../db/repositories/profileRepository.js";
import { findTopicTemplate } from "../../prompts/conflict.js";
import { buildSummonPerformanceInstructions } from "../../core/performanceInstructions.js";

const InputShape = {
  context: z.string().min(1).describe("The situation or dilemma the user is facing."),
  topic: z.string().optional().describe("Optional short topic label, e.g. 'quitting my job'."),
  sessionId: z.string().default("default").describe("Session/project identifier for state isolation."),
};

export function registerSummonDevilTool(server: McpServer): void {
  server.tool(
    "summon_devil",
    "Summons Devil to give a bold, freedom-driven perspective on a situation — no conflict, just Devil's take.",
    InputShape,
    async (rawInput) => {
      const input = SummonInputSchema.parse(rawInput);
      const profile = getProfile("devil");
      const template = findTopicTemplate([input.context, input.topic].filter(Boolean).join(" "));

      const perspective = {
        position: template.devil.position,
        reasoning: template.devil.reasoning,
        temptation: template.devil.temptation,
      };

      const result = {
        profile,
        perspective,
        // Plan A: Client LLM writes Devil's monologue from profile + optional seed.
        performance_instructions: buildSummonPerformanceInstructions(
          "devil",
          profile,
          perspective,
          { userContext: [input.context, input.topic].filter(Boolean).join(" ") },
        ),
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
