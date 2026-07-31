import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  EndConflictInputSchema,
  type Winner,
} from "../../types/index.js";
import { applyConflictResult } from "../../core/relationshipEngine.js";
import { remember, recall, recallOutcomes, buildTrackRecord } from "../../core/memoryEngine.js";
import {
  getOrCreateRelationship,
  saveRelationship,
} from "../../db/repositories/relationshipRepository.js";
import {
  getActiveConflictById,
  getOpenActiveConflict,
  listDebateTurns,
  saveActiveConflict,
  updateDebateTurnUtterance,
} from "../../db/repositories/activeConflictRepository.js";
import { buildEndConflictPerformanceInstructions } from "../../core/performanceInstructions.js";

const InputShape = {
  sessionId: z
    .string()
    .default("default")
    .describe("Session/project identifier for state isolation."),
  conflictId: z
    .string()
    .uuid()
    .optional()
    .describe("Active conflict id. Defaults to the session's open turn-mode conflict."),
  winner: z
    .enum(["angel", "devil", "draw"])
    .optional()
    .describe(
      "Who ACTUALLY argued more persuasively across the turns just performed — judge this yourself from the dialogue content. Prefer passing this explicitly. If omitted, falls back to the engine's likelyWinner, which was rolled BEFORE the debate started (weighted by banked respect, not by anything said) and should be treated as a last resort, not a trusted verdict.",
    ),
  lastUtterance: z
    .string()
    .optional()
    .describe("Optional final performed line to store on the last turn."),
};

export function registerEndConflictTool(server: McpServer): void {
  server.tool(
    "end_inner_conflict",
    "Closes a turn-by-turn debate from start_debate: records conflict memory, updates relationship scores, returns out-of-character next-step performance_instructions. Pass `winner` based on your own read of the turns performed — the silent default is a pre-debate random draw, not a verdict on what was actually argued.",
    InputShape,
    async (rawInput) => {
      const input = EndConflictInputSchema.parse(rawInput);

      const active = input.conflictId
        ? getActiveConflictById(input.conflictId)
        : getOpenActiveConflict(input.sessionId);

      if (!active || active.sessionId !== input.sessionId) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: false,
                  error: "no_active_conflict",
                  message:
                    "No open turn-by-turn debate to end. Call start_debate first."
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      if (active.status !== "open") {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: false,
                  error: "conflict_not_open",
                  status: active.status,
                  conflictId: active.id,
                  message: `Conflict ${active.id} is already ${active.status}.`,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      if (input.lastUtterance && active.turnIndex > 0) {
        updateDebateTurnUtterance(
          active.id,
          active.turnIndex,
          input.lastUtterance,
        );
      }

      const winner: Winner =
        input.winner ??
        (active.likelyWinner === "angel" ||
        active.likelyWinner === "devil" ||
        active.likelyWinner === "draw"
          ? active.likelyWinner
          : "draw");

      const relationshipBefore = getOrCreateRelationship(input.sessionId, active.domain);
      const savedConflict = remember({
        sessionId: input.sessionId,
        domain: active.domain,
        context: active.context,
        topic: active.topic,
        angelPosition: active.angel.position,
        devilPosition: active.devil.position,
        winner,
        absurdityLevel: active.absurdityLevel,
      });

      const relationshipAfter = applyConflictResult({
        relationship: relationshipBefore,
        winner,
        isRoleReversal: active.isRoleReversal,
      });
      saveRelationship(relationshipAfter);

      const closed = {
        ...active,
        status: "completed" as const,
        likelyWinner: winner,
        updatedAt: Date.now(),
      };
      saveActiveConflict(closed);

      const turns = listDebateTurns(active.id);
      const recentMemory = recall(input.sessionId, 3, active.domain);

      const result = {
        mode: "turn" as const,
        ok: true,
        ended: true,
        conflictId: closed.id,
        context: closed.context,
        domain: closed.domain,
        winner,
        turnsPerformed: turns.length,
        maxTurns: closed.maxTurns,
        isRoleReversal: closed.isRoleReversal,
        conflict: {
          id: savedConflict.id,
          activeConflictId: closed.id,
          coreDisagreement: closed.coreDisagreement,
          likelyWinner: winner,
          isRoleReversal: closed.isRoleReversal,
          absurdityLevel: closed.absurdityLevel,
        },
        relationship: relationshipAfter,
        recent_memory: recentMemory,
        turns,
        performance_instructions: buildEndConflictPerformanceInstructions({
          conflict: closed,
          winner,
          relationship: relationshipAfter,
          trackRecord: buildTrackRecord(recallOutcomes(input.sessionId, 20, active.domain)),
        }),
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
