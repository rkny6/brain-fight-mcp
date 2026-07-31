import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ContinueConflictTurnInputSchema,
  SpeakerSchema,
} from "../../types/index.js";
import { getOrCreateRelationship } from "../../db/repositories/relationshipRepository.js";
import {
  appendDebateTurn,
  getActiveConflictById,
  getOpenActiveConflict,
  saveActiveConflict,
  updateDebateTurnUtterance,
} from "../../db/repositories/activeConflictRepository.js";
import { buildTurnPerformanceInstructions } from "../../core/performanceInstructions.js";
import {
  pickNextSpeaker,
  turnsRemaining,
} from "../../core/turnEngine.js";

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
  speaker: SpeakerSchema.optional().describe(
    "Force this speaker (user point-out). Otherwise alternate from lastSpeaker, with rare double-taps.",
  ),
  userInterjection: z
    .string()
    .optional()
    .describe("User's latest interjection the current speaker should answer."),
  lastUtterance: z
    .string()
    .optional()
    .describe("Transcript of the previous performed line (helps the next speaker react)."),
};

export function registerContinueConflictTurnTool(server: McpServer): void {
  server.tool(
    "continue_conflict_turn",
    "Advance a turn-by-turn debate (from start_debate) by one speaker. Returns performance_instructions for ONLY that speaker. Use end_inner_conflict when maxTurns is reached or the user wants to stop.",
    InputShape,
    async (rawInput) => {
      const input = ContinueConflictTurnInputSchema.parse(rawInput);

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
                    "No open turn-by-turn debate for this session. Call start_debate first.",
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
                  message: `Conflict ${active.id} is ${active.status}. Call start_debate to open a new turn-by-turn debate.`,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      const relationship = getOrCreateRelationship(input.sessionId, active.domain);

      if (active.turnIndex >= active.maxTurns) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: false,
                  error: "max_turns_reached",
                  conflictId: active.id,
                  turnIndex: active.turnIndex,
                  maxTurns: active.maxTurns,
                  message:
                    "Max turns reached. Call end_inner_conflict to settle relationship state and give the user a next step.",
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

      const lastSpeaker = active.lastSpeaker ?? active.firstSpeaker;
      const { speaker, isDoubleTap } = pickNextSpeaker({
        lastSpeaker,
        forceSpeaker: input.speaker,
        relationship,
      });

      const turnIndex = active.turnIndex + 1;
      appendDebateTurn({
        conflictId: active.id,
        turnIndex,
        speaker,
        isDoubleTap,
        userInterjection: input.userInterjection,
      });

      const atCap = turnIndex >= active.maxTurns;
      const suggestedNext = atCap
        ? speaker
        : pickNextSpeaker({
            lastSpeaker: speaker,
            relationship,
          }).speaker;

      const updated = {
        ...active,
        turnIndex,
        lastSpeaker: speaker,
        nextSpeaker: suggestedNext,
        updatedAt: Date.now(),
      };
      saveActiveConflict(updated);

      const result = {
        mode: "turn" as const,
        ok: true,
        conflictId: updated.id,
        context: updated.context,
        turn: {
          index: turnIndex,
          maxTurns: updated.maxTurns,
          speaker,
          isDoubleTap,
          turnsRemaining: turnsRemaining(turnIndex, updated.maxTurns),
          lastSpeaker: speaker,
          nextSpeaker: updated.nextSpeaker,
          status: updated.status,
          shouldEnd: atCap,
        },
        angel: updated.angel,
        devil: updated.devil,
        conflict: {
          id: updated.id,
          coreDisagreement: updated.coreDisagreement,
          likelyWinner: updated.likelyWinner,
          isRoleReversal: updated.isRoleReversal,
          absurdityLevel: updated.absurdityLevel,
        },
        relationship,
        performance_instructions: buildTurnPerformanceInstructions({
          conflict: updated,
          speaker,
          turnIndex,
          maxTurns: updated.maxTurns,
          isDoubleTap,
          relationship,
          userInterjection: input.userInterjection,
          lastUtterance: input.lastUtterance,
        }),
        how_to_continue: atCap
          ? "Max turns reached after this line. Perform ONLY this speaker, then call end_inner_conflict."
          : "Perform ONLY this speaker's line, then call continue_conflict_turn again or end_inner_conflict.",
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
