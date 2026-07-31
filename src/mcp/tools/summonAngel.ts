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

export function registerSummonAngelTool(server: McpServer): void {
  server.tool(
    "summon_angel",
    "Summons Angel to give a cautious, values-driven perspective on a situation — no conflict, just Angel's take.",
    InputShape,
    async (rawInput) => {
      const input = SummonInputSchema.parse(rawInput);
      const profile = getProfile("angel");
      const template = findTopicTemplate([input.context, input.topic].filter(Boolean).join(" "));

      const perspective = {
        position: template.angel.position,
        reasoning: template.angel.reasoning,
        concern: template.angel.concern,
      };

      const result = {
        profile,
        perspective,
        // Plan A: Client LLM writes Angel's monologue from profile + optional seed.
        performance_instructions: buildSummonPerformanceInstructions(
          "angel",
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
