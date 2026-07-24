import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IntensitySchema, StartConflictInputSchema } from "../../types/index.js";
import { runConflict } from "../../core/conflictEngine.js";
import { applyConflictResult } from "../../core/relationshipEngine.js";
import { remember, recall } from "../../core/memoryEngine.js";
import { buildContinuityHooks } from "../../core/continuityEngine.js";
import {
  getOrCreateRelationship,
} from "../../db/repositories/relationshipRepository.js";
import { saveRelationship } from "../../db/repositories/relationshipRepository.js";
import { buildConflictPerformanceInstructions } from "../../core/performanceInstructions.js";

const InputShape = {
  context: z.string().min(1).describe("The situation or dilemma the user is facing."),
  topic: z.string().optional().describe("Optional short topic label, e.g. 'quitting my job'."),
  intensity: IntensitySchema.default("medium").describe(
    "How extreme/dramatic the debate should be: low, medium, or high."
  ),
  sessionId: z.string().default("default").describe("Session/project identifier for state isolation."),
};

export function registerStartConflictTool(server: McpServer): void {
  server.tool(
    "start_inner_conflict",
    "Stages a full Angel vs Devil debate over a situation, updates their evolving relationship, injects prior-round continuity when the session has history, and returns performance instructions for the Client LLM to act it out.",
    InputShape,
    async (rawInput) => {
      const input = StartConflictInputSchema.parse(rawInput);

      const relationshipBefore = getOrCreateRelationship(input.sessionId);
      // Recall BEFORE writing this conflict so continuity hooks point at last round.
      const priors = recall(input.sessionId, 3);
      const continuityHooks = buildContinuityHooks(priors);

      const conflictOutput = runConflict({
        context: input.context,
        topic: input.topic,
        intensity: input.intensity,
        relationship: relationshipBefore,
        priorConflicts: priors,
      });

      const savedConflict = remember({
        sessionId: input.sessionId,
        context: input.context,
        topic: input.topic,
        angelPosition: conflictOutput.angel.position,
        devilPosition: conflictOutput.devil.position,
        winner: conflictOutput.likelyWinner,
        absurdityLevel: conflictOutput.absurdityLevel,
      });

      const relationshipAfter = applyConflictResult({
        relationship: relationshipBefore,
        winner: conflictOutput.likelyWinner,
        isRoleReversal: conflictOutput.isRoleReversal,
      });
      saveRelationship(relationshipAfter);

      const recentMemory = recall(input.sessionId, 3);

      const result = {
        context: input.context,
        angel: conflictOutput.angel,
        devil: conflictOutput.devil,
        conflict: {
          id: savedConflict.id,
          coreDisagreement: conflictOutput.coreDisagreement,
          likelyWinner: conflictOutput.likelyWinner,
          isRoleReversal: conflictOutput.isRoleReversal,
          absurdityLevel: conflictOutput.absurdityLevel,
        },
        continuity: conflictOutput.continuity,
        relationship: relationshipAfter,
        recent_memory: recentMemory,
        performance_instructions: buildConflictPerformanceInstructions(
          conflictOutput,
          continuityHooks
        ),
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
