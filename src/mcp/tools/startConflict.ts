import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ConflictSeedSchema,
  DEFAULT_TOPIC_DOMAIN,
  IntensitySchema,
  SpeakerSchema,
  StartDebateInputSchema,
  TopicDomainSchema,
  type TopicDomain,
} from "../../types/index.js";
import { runConflict } from "../../core/conflictEngine.js";
import { recall, recallOutcomes, buildTrackRecord } from "../../core/memoryEngine.js";
import { getOrCreateRelationship } from "../../db/repositories/relationshipRepository.js";
import { buildTurnPerformanceInstructions } from "../../core/performanceInstructions.js";
import {
  abandonOpenConflicts,
  appendDebateTurn,
  createActiveConflict,
  saveActiveConflict,
} from "../../db/repositories/activeConflictRepository.js";
import { runStorageMaintenance } from "../../db/repositories/retention.js";
import {
  inferTopicBias,
  maxTurnsForIntensity,
  pickFirstSpeaker,
  pickNextSpeaker,
  turnsRemaining,
} from "../../core/turnEngine.js";

const SharedInputShape = {
  context: z.string().min(1).describe("The situation or dilemma the user is facing."),
  topic: z.string().optional().describe("Optional short topic label, e.g. 'quitting my job'."),
  intensity: IntensitySchema.default("medium").describe(
    "How extreme/dramatic the debate should be: low, medium, or high.",
  ),
  sessionId: z
    .string()
    .default("default")
    .describe("Session/project identifier for state isolation."),
  domain: TopicDomainSchema.default(DEFAULT_TOPIC_DOMAIN).describe(
    "Life-area bucket for relationship state and track-record stats: career | money | relationships | health | general. Pick the one that best matches the user's actual situation — don't default to 'general' when a clearer bucket applies, since this is what keeps trust/outcome history from blending unrelated decisions together.",
  ),
  seed: ConflictSeedSchema.optional().describe(
    "RECOMMENDED FIRST: constraint-axis seed { tension, angelMust, devilMust, userDetails?, forbidden? } — not full monologue lines. Legacy full stance fields still accepted. Overrides keyword/overlap/generic templates. Omitting seed is allowed: server picks best keyword/overlap topic template (else Safety-vs-Freedom) and auto-extracts userDetails anchors from context for grounding.",
  ),
};

const DebateInputShape = {
  ...SharedInputShape,
  firstSpeaker: SpeakerSchema.optional().describe(
    "Optional who speaks first in the turn-by-turn debate.",
  ),
};

type DebateArgs = {
  context: string;
  topic?: string;
  intensity: "low" | "medium" | "high";
  sessionId: string;
  domain: TopicDomain;
  seed?: unknown;
  firstSpeaker?: "angel" | "devil";
};

async function runStartDebate(input: DebateArgs) {
  const relationshipBefore = getOrCreateRelationship(input.sessionId, input.domain);
  const priors = recall(input.sessionId, 3, input.domain);

  const conflictOutput = runConflict({
    context: input.context,
    topic: input.topic,
    intensity: input.intensity,
    relationship: relationshipBefore,
    priorConflicts: priors,
    seed: input.seed as never,
  });

  abandonOpenConflicts(input.sessionId, input.domain);
  // Opportunistic cleanup — cheap no-op on the common path, and this is
  // the only place a debate naturally gets started, so it's the natural
  // place to sweep stale rows / cap durable history without a cron.
  runStorageMaintenance();

  const topicBias = inferTopicBias(
    [input.context, input.topic].filter(Boolean).join(" "),
  );
  const firstSpeaker = pickFirstSpeaker({
    userChoice: input.firstSpeaker,
    relationship: relationshipBefore,
    priorWinner: relationshipBefore.recentWinner,
    topicBias,
  });
  const maxTurns = maxTurnsForIntensity(input.intensity);

  const active = createActiveConflict({
    sessionId: input.sessionId,
    domain: input.domain,
    context: input.context,
    topic: input.topic,
    intensity: input.intensity,
    coreDisagreement: conflictOutput.coreDisagreement,
    angel: conflictOutput.angel,
    devil: conflictOutput.devil,
    likelyWinner: conflictOutput.likelyWinner,
    isRoleReversal: conflictOutput.isRoleReversal,
    absurdityLevel: conflictOutput.absurdityLevel,
    continuity: conflictOutput.continuity,
    brief: conflictOutput.brief,
    firstSpeaker,
    nextSpeaker: firstSpeaker,
    maxTurns,
  });

  const turnIndex = 1;
  const isDoubleTap = false;
  appendDebateTurn({
    conflictId: active.id,
    turnIndex,
    speaker: firstSpeaker,
    isDoubleTap,
  });

  const suggestedNext =
    turnIndex >= maxTurns
      ? firstSpeaker
      : pickNextSpeaker({
          lastSpeaker: firstSpeaker,
          relationship: relationshipBefore,
        }).speaker;

  const opened = {
    ...active,
    turnIndex,
    lastSpeaker: firstSpeaker as typeof firstSpeaker,
    nextSpeaker: (turnIndex >= maxTurns
      ? firstSpeaker
      : suggestedNext) as typeof firstSpeaker,
    updatedAt: Date.now(),
  };
  saveActiveConflict(opened);

  const result = {
    mode: "turn" as const,
    tool: "start_debate" as const,
    context: input.context,
    domain: input.domain,
    conflictId: opened.id,
    turn: {
      index: turnIndex,
      maxTurns,
      speaker: firstSpeaker,
      isDoubleTap,
      turnsRemaining: turnsRemaining(turnIndex, maxTurns),
      lastSpeaker: firstSpeaker,
      nextSpeaker: opened.nextSpeaker,
      status: opened.status,
      shouldEnd: turnIndex >= maxTurns,
    },
    angel: conflictOutput.angel,
    devil: conflictOutput.devil,
    conflict: {
      id: opened.id,
      coreDisagreement: conflictOutput.coreDisagreement,
      brief: conflictOutput.brief,
      likelyWinner: conflictOutput.likelyWinner,
      isRoleReversal: conflictOutput.isRoleReversal,
      absurdityLevel: conflictOutput.absurdityLevel,
    },
    continuity: conflictOutput.continuity,
    relationship: relationshipBefore,
    recent_memory: priors,
    performance_instructions: buildTurnPerformanceInstructions({
      conflict: opened,
      speaker: firstSpeaker,
      turnIndex,
      maxTurns,
      isDoubleTap,
      relationship: relationshipBefore,
      trackRecord: buildTrackRecord(recallOutcomes(input.sessionId, 20, input.domain)),
    }),
    how_to_continue:
      "Perform ONLY this speaker's line, then call continue_conflict_turn (optionally with lastUtterance / userInterjection / speaker override). When ready, call end_inner_conflict WITH an explicit winner based on which side actually argued better in this exchange — the tool's default winner is a pre-debate random draw, not a judgment of the dialogue.",
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  };
}

/** Turn-by-turn debate: Angel/Devil alternate one speaker per call. This is
 * the only debate engine — the one-shot full-skit mode was removed, and
 * there is no legacy alias since this hasn't shipped a public release yet. */
export function registerStartDebateTool(server: McpServer): void {
  server.tool(
    "start_debate",
    "Start a turn-by-turn Angel vs Devil debate (one speaker per response). Then continue_conflict_turn for each next line, and end_inner_conflict when done. Recommended: write a constraint-axis seed first. Server makes no LLM calls.",
    DebateInputShape,
    async (rawInput) => {
      const input = StartDebateInputSchema.parse(rawInput);
      return runStartDebate(input);
    },
  );
}
