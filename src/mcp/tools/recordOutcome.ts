import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ActualChoiceSchema,
  OutcomeSentimentSchema,
  RecordOutcomeInputSchema,
} from "../../types/index.js";
import { rememberOutcome, recallOutcomes, recallConflictById, buildTrackRecord } from "../../core/memoryEngine.js";

const InputShape = {
  sessionId: z
    .string()
    .default("default")
    .describe("Session/project identifier for state isolation."),
  conflictId: z
    .string()
    .uuid()
    .describe(
      "The conflict.id returned by start_debate / end_inner_conflict for the round this outcome belongs to.",
    ),
  actualChoice: ActualChoiceSchema.describe(
    "Which side the user actually went with in real life — not who 'won' the performed debate.",
  ),
  outcomeNote: z
    .string()
    .optional()
    .describe("Brief note in the user's own words about what happened, if known yet."),
  sentiment: OutcomeSentimentSchema.optional().describe(
    "How it turned out, if the user has reported that: 'good' | 'regret' | 'mixed' | 'too_early' (they haven't found out yet).",
  ),
};

export function registerRecordOutcomeTool(server: McpServer): void {
  server.tool(
    "record_decision_outcome",
    "Call this when the user later mentions what they actually decided or how it turned out for a past conflict — e.g. they come back days later and say 'I ended up quitting' or 'I took the risk and it backfired'. Do NOT call this speculatively or ask the user to fill out a form; only record what they've actually volunteered. This is what lets future debates and get_relationship reference a real track record instead of just theatrics.",
    InputShape,
    async (rawInput) => {
      const input = RecordOutcomeInputSchema.parse(rawInput);

      const existing = recallConflictById(input.conflictId, input.sessionId);
      if (!existing) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: false,
                  error: "conflict_not_found",
                  message:
                    "No conflict with that id was found for this session (it may be from a different session, or the id is mistyped/hallucinated). Outcomes can only be attached to a real prior conflict.id — don't guess one.",
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      const outcome = rememberOutcome({
        conflictId: input.conflictId,
        sessionId: input.sessionId,
        domain: existing.domain,
        actualChoice: input.actualChoice,
        outcomeNote: input.outcomeNote,
        sentiment: input.sentiment,
      });

      const trackRecord = buildTrackRecord(
        recallOutcomes(input.sessionId, 20, existing.domain),
      );

      const result = {
        ok: true,
        recorded: outcome,
        trackRecord,
        performance_instructions:
          "Step OUT of character to acknowledge this briefly and warmly — do not restage a debate. One or two sentences, no bullet points, no moralizing about whether they made the 'right' choice.",
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
