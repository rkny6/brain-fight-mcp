import { z } from "zod";

/** ---------------------------------------------------------------------
 * Archetypes
 * ------------------------------------------------------------------- */

export const ArchetypeSchema = z.enum(["angel", "devil"]);
export type Archetype = z.infer<typeof ArchetypeSchema>;

export const IntensitySchema = z.enum(["low", "medium", "high"]);
export type Intensity = z.infer<typeof IntensitySchema>;

/** Maps the human-friendly intensity dial to a numeric extremity multiplier. */
export const INTENSITY_VALUE: Record<Intensity, number> = {
  low: 0.3,
  medium: 0.6,
  high: 0.9,
};

/** full = one-shot script; turn = one speaker per tool call. */


export const SpeakerSchema = z.enum(["angel", "devil"]);
export type Speaker = z.infer<typeof SpeakerSchema>;

/** Soft topic bias used only for first-speaker heuristics. */
export const TopicBiasSchema = z.enum(["caution", "impulse", "neutral"]);
export type TopicBias = z.infer<typeof TopicBiasSchema>;

export const ActiveConflictStatusSchema = z.enum([
  "open",
  "completed",
  "abandoned",
]);
export type ActiveConflictStatus = z.infer<typeof ActiveConflictStatusSchema>;

/** ---------------------------------------------------------------------
 * Character Profile / Voice Card
 * ------------------------------------------------------------------- */

/**
 * Executable performance rails for the Client LLM.
 * Prefer these over free-form adjectives when generating dialogue.
 */
export const VoiceCardSchema = z.object({
  /** Positive performance rules (how to sound / argue). */
  do: z.array(z.string()).min(1),
  /** Soft avoidances (habits that flatten the character). */
  dont: z.array(z.string()).min(1),
  /** Sentence rhythm / length / turn shape. */
  cadence: z.string().min(1),
  /** Recurring argument moves unique to this side. */
  signatureMoves: z.array(z.string()).min(1),
  /** Hard bans for this voice (still comedy, never real harm coaching). */
  never: z.array(z.string()).min(1),
  /** Optional: a private contradiction that may leak under pressure. */
  secretLeak: z.string().optional(),
});
export type VoiceCard = z.infer<typeof VoiceCardSchema>;

export const CharacterProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  archetype: ArchetypeSchema,
  traits: z.array(z.string()),
  values: z.array(z.string()),
  /** Short prose summary (resources / humans). Prefer `voice` for performance. */
  speakingStyle: z.string(),
  /** Structured director notes for Client LLM performance (default / English). */
  voice: VoiceCardSchema,
  /**
   * Optional Chinese performance rails. When the user writes in Chinese,
   * Client instructions should prefer this card so both sides do not collapse
   * into the same formal "辩论体".
   */
  voiceZh: VoiceCardSchema.optional(),
  intensity: z.number().min(0).max(1),
});
export type CharacterProfile = z.infer<typeof CharacterProfileSchema>;

/** ---------------------------------------------------------------------
 * Topic Domain — life-area bucket for relationship state and track-record
 * stats, so e.g. career decisions and trivial snack decisions don't share
 * one blended trust score and outcome history.
 * ------------------------------------------------------------------- */

export const TopicDomainSchema = z.enum([
  "career",
  "money",
  "relationships",
  "health",
  "general",
]);
export type TopicDomain = z.infer<typeof TopicDomainSchema>;
export const DEFAULT_TOPIC_DOMAIN: TopicDomain = "general";

/** ---------------------------------------------------------------------
 * Relationship Milestones — rare, one-time narrative beats fired when a
 * (session, domain) bucket first crosses a meaningful threshold. Each key
 * fires AT MOST ONCE ever per bucket — this is what real ongoing history
 * makes possible that a stateless debate tool structurally can't do.
 * ------------------------------------------------------------------- */

export const MilestoneKeySchema = z.enum([
  "high_cooperation",
  "devil_streak_5",
  "angel_streak_5",
  "conflicts_10",
]);
export type MilestoneKey = z.infer<typeof MilestoneKeySchema>;

export interface MilestoneHit {
  key: MilestoneKey;
  /** Short, factual note for the calling LLM — not dialogue, just what happened. */
  note: string;
}

export const RelationshipMilestoneSchema = z.object({
  sessionId: z.string(),
  domain: TopicDomainSchema,
  key: MilestoneKeySchema,
  reachedAt: z.number().int(),
});
export type RelationshipMilestone = z.infer<typeof RelationshipMilestoneSchema>;

/** ---------------------------------------------------------------------
 * Relationship State
 * ------------------------------------------------------------------- */

export const WinnerSchema = z.union([
  z.literal("angel"),
  z.literal("devil"),
  z.literal("draw"),
  z.null(),
]);
export type Winner = z.infer<typeof WinnerSchema>;

export const RelationshipStateSchema = z.object({
  sessionId: z.string(),
  domain: TopicDomainSchema,
  angelRespect: z.number().min(0).max(1),
  devilRespect: z.number().min(0).max(1),
  angelAnnoyance: z.number().min(0).max(1),
  devilAnnoyance: z.number().min(0).max(1),
  cooperation: z.number().min(0).max(1),
  recentWinner: WinnerSchema,
  totalConflicts: z.number().int().min(0),
});
export type RelationshipState = z.infer<typeof RelationshipStateSchema>;

/** Defaults used when a session/domain has no row yet (mirrors the SQL DEFAULTs). */
export const DEFAULT_RELATIONSHIP_STATE: Omit<
  RelationshipState,
  "sessionId" | "domain"
> = {
  angelRespect: 0.5,
  devilRespect: 0.5,
  angelAnnoyance: 0.2,
  devilAnnoyance: 0.2,
  cooperation: 0.3,
  recentWinner: null,
  totalConflicts: 0,
};

/** ---------------------------------------------------------------------
 * Conflict Record
 * ------------------------------------------------------------------- */

export const ConflictRecordSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string(),
  domain: TopicDomainSchema,
  context: z.string(),
  topic: z.string().optional(),
  angelPosition: z.string(),
  devilPosition: z.string(),
  winner: WinnerSchema,
  absurdityLevel: z.number().min(0).max(1),
  createdAt: z.number().int(),
});
export type ConflictRecord = z.infer<typeof ConflictRecordSchema>;

/** ---------------------------------------------------------------------
 * Decision Outcome — what the user actually did after a closed conflict,
 * and (optionally) how it went. Without this the tool can dramatize a
 * decision but never learns whether pushing the user toward Angel's or
 * Devil's side was actually good guidance for them.
 * ------------------------------------------------------------------- */

export const ActualChoiceSchema = z.enum(["angel", "devil", "neither", "mixed"]);
export type ActualChoice = z.infer<typeof ActualChoiceSchema>;

export const OutcomeSentimentSchema = z.enum([
  "good",
  "regret",
  "mixed",
  "too_early",
]);
export type OutcomeSentiment = z.infer<typeof OutcomeSentimentSchema>;

export const DecisionOutcomeSchema = z.object({
  id: z.string().uuid(),
  conflictId: z.string().uuid(),
  sessionId: z.string(),
  domain: TopicDomainSchema,
  actualChoice: ActualChoiceSchema,
  outcomeNote: z.string().optional(),
  sentiment: OutcomeSentimentSchema.optional(),
  recordedAt: z.number().int(),
});
export type DecisionOutcome = z.infer<typeof DecisionOutcomeSchema>;

export const RecordOutcomeInputSchema = z.object({
  sessionId: z.string().default("default"),
  conflictId: z.string().uuid(),
  actualChoice: ActualChoiceSchema,
  outcomeNote: z.string().optional(),
  sentiment: OutcomeSentimentSchema.optional(),
});
export type RecordOutcomeInput = z.infer<typeof RecordOutcomeInputSchema>;

/** ---------------------------------------------------------------------
 * Conflict Engine input/output
 * ------------------------------------------------------------------- */

export const ConflictEngineInputSchema = z.object({
  context: z.string().min(1, "context is required"),
  topic: z.string().optional(),
  intensity: IntensitySchema.default("medium"),
  sessionId: z.string().default("default"),
});
export type ConflictEngineInput = z.infer<typeof ConflictEngineInputSchema>;

export const SidePositionSchema = z.object({
  position: z.string(),
  reasoning: z.string(),
  /** Angel-only: what the angel is worried about. */
  concern: z.string().optional(),
  /** Devil-only: what the devil is dangling as bait. */
  temptation: z.string().optional(),
});
export type SidePosition = z.infer<typeof SidePositionSchema>;

export const ContinuityPriorSchema = z.object({
  context: z.string(),
  angelPosition: z.string(),
  devilPosition: z.string(),
  winner: WinnerSchema,
});
export type ContinuityPrior = z.infer<typeof ContinuityPriorSchema>;

export const ContinuitySchema = z.object({
  hasPrior: z.boolean(),
  prior: ContinuityPriorSchema.nullable(),
  angelCallback: z.string(),
  devilCallback: z.string(),
});
export type Continuity = z.infer<typeof ContinuitySchema>;

export const ConflictEngineOutputSchema = z.object({
  angel: SidePositionSchema,
  devil: SidePositionSchema,
  coreDisagreement: z.string(),
  likelyWinner: WinnerSchema,
  isRoleReversal: z.boolean(),
  absurdityLevel: z.number().min(0).max(1),
  /** Callbacks derived from the previous conflict in this session, if any. */
  continuity: ContinuitySchema,
  /** Normalized constraint/legacy/template brief for performance instructions. */
  brief: z
    .object({
      tension: z.string(),
      angelMust: z.string(),
      devilMust: z.string(),
      userDetails: z.array(z.string()),
      forbidden: z.array(z.string()),
      source: z.enum(["constraint_seed", "legacy_seed", "template"]),
    })
    .optional(),
});
export type ConflictEngineOutput = z.infer<typeof ConflictEngineOutputSchema>;

/** ---------------------------------------------------------------------
 * Tool-facing input schemas
 * ------------------------------------------------------------------- */

export const SummonInputSchema = z.object({
  context: z.string().min(1, "context is required"),
  topic: z.string().optional(),
  sessionId: z.string().default("default"),
});
export type SummonInput = z.infer<typeof SummonInputSchema>;

/**
 * Preferred seed form: constraint axes, not recitable monologue lines.
 * Client LLM invents all dialogue from these rails + user details.
 */
export const ConstraintSeedSchema = z.object({
  tension: z
    .string()
    .min(1)
    .describe(
      "What this round is actually about in one line, e.g. 'Ship Friday vs wait for the load test.'",
    ),
  angelMust: z
    .string()
    .min(1)
    .describe(
      "Constraint Angel must argue (axis / obligation), not a finished line — e.g. 'Irreversible cost of a Friday prod melt / protect weekend on-call.'",
    ),
  devilMust: z
    .string()
    .min(1)
    .describe(
      "Constraint Devil must argue (axis / opportunity), not a finished line — e.g. 'Marketing window closes; delay is fear dressed as process.'",
    ),
  userDetails: z
    .array(z.string().min(1))
    .default([])
    .describe(
      "Concrete nouns/facts from the user to force grounding (deadlines, people, money, systems).",
    ),
  forbidden: z
    .array(z.string().min(1))
    .default([])
    .describe(
      "Optional bans, e.g. 'generic safety vs freedom slogan', 'HR pamphlet tone', 'preachy ending'.",
    ),
});
export type ConstraintSeed = z.infer<typeof ConstraintSeedSchema>;

/**
 * Legacy full-stance seed (still accepted). Prefer ConstraintSeedSchema —
 * full sentences here are easier for the Client LLM to accidentally recite.
 */
export const LegacyStanceSeedSchema = z.object({
  coreDisagreement: z.string().describe(
    "One sentence framing what this specific round is actually about.",
  ),
  angelPosition: z.string().describe("Angel's specific stance on THIS situation."),
  angelReasoning: z.string().describe("Angel's specific reasoning for THIS situation."),
  angelConcern: z.string().describe("What Angel is specifically worried about here."),
  devilPosition: z.string().describe("Devil's specific stance on THIS situation."),
  devilReasoning: z.string().describe("Devil's specific reasoning for THIS situation."),
  devilTemptation: z.string().describe("What Devil is specifically dangling here."),
});
export type LegacyStanceSeed = z.infer<typeof LegacyStanceSeedSchema>;

/** Caller-supplied seed: prefer constraint axes; legacy stance form still works. */
export const ConflictSeedSchema = z.union([
  ConstraintSeedSchema,
  LegacyStanceSeedSchema,
]);
export type ConflictSeed = z.infer<typeof ConflictSeedSchema>;

/** Normalized debate brief used by engines + performance instructions. */
export const DebateBriefSchema = z.object({
  tension: z.string(),
  angelMust: z.string(),
  devilMust: z.string(),
  userDetails: z.array(z.string()),
  forbidden: z.array(z.string()),
  source: z.enum(["constraint_seed", "legacy_seed", "template"]),
});
export type DebateBrief = z.infer<typeof DebateBriefSchema>;

const StartSharedFields = {
  context: z.string().min(1, "context is required"),
  topic: z.string().optional(),
  intensity: IntensitySchema.default("medium"),
  sessionId: z.string().default("default"),
  domain: TopicDomainSchema.default(DEFAULT_TOPIC_DOMAIN).describe(
    "Life-area bucket for relationship state and track-record stats: career | money | relationships | health | general. Pick the one that best matches the user's actual situation — don't default to 'general' when a clearer bucket applies, since this is what keeps trust/outcome history from blending unrelated decisions together.",
  ),
  seed: ConflictSeedSchema.optional().describe(
    "Recommended FIRST: constraint-axis seed { tension, angelMust, devilMust, userDetails?, forbidden? }. Legacy full stance fields still accepted. Overrides keyword templates. Omitting seed accepts keyword/generic framing (more template-like).",
  ),
} as const;

/** Turn-by-turn debate (`start_debate`): one speaker per tool call. This is
 * now the only debate mechanism — the one-shot full-skit mode was removed
 * because its winner was always a pre-debate random draw with no chance
 * for the calling client to correct it against what was actually argued. */
export const StartDebateInputSchema = z.object({
  ...StartSharedFields,
  firstSpeaker: SpeakerSchema.optional().describe(
    "Optional override for who speaks first.",
  ),
});
export type StartDebateInput = z.infer<typeof StartDebateInputSchema>;

export const ContinueConflictTurnInputSchema = z.object({
  sessionId: z.string().default("default"),
  conflictId: z
    .string()
    .uuid()
    .optional()
    .describe(
      "Active conflict id from start_debate. Defaults to the session's open conflict.",
    ),
  speaker: SpeakerSchema.optional().describe(
    "Force this speaker for the next turn (user point-out). Otherwise uses alternating nextSpeaker, with rare double-taps.",
  ),
  userInterjection: z
    .string()
    .optional()
    .describe("What the user just said / asked; the current speaker should respond to it."),
  lastUtterance: z
    .string()
    .optional()
    .describe("Optional transcript of the previous speaker line the Client LLM just performed."),
});
export type ContinueConflictTurnInput = z.infer<
  typeof ContinueConflictTurnInputSchema
>;

export const EndConflictInputSchema = z.object({
  sessionId: z.string().default("default"),
  conflictId: z
    .string()
    .uuid()
    .optional()
    .describe("Active conflict id. Defaults to the session's open conflict."),
  winner: z
    .enum(["angel", "devil", "draw"])
    .optional()
    .describe(
      "Who felt more persuasive this debate. Defaults to the engine's likelyWinner seed if omitted.",
    ),
  lastUtterance: z
    .string()
    .optional()
    .describe("Optional final line transcript before closing."),
});
export type EndConflictInput = z.infer<typeof EndConflictInputSchema>;

export const GetRelationshipInputSchema = z.object({
  sessionId: z.string().default("default"),
  domain: TopicDomainSchema.optional().describe(
    "Look up just this domain's relationship/track record. Omit to also get an all-domains summary alongside the default bucket.",
  ),
});
export type GetRelationshipInput = z.infer<typeof GetRelationshipInputSchema>;

export const ResetRelationshipInputSchema = z.object({
  sessionId: z.string().default("default"),
  domain: TopicDomainSchema.optional().describe(
    "Reset just this domain's relationship/history. Omit to reset ALL domains for this session (matches the old pre-domain behavior).",
  ),
  confirm: z.boolean().default(false),
});
export type ResetRelationshipInput = z.infer<typeof ResetRelationshipInputSchema>;

/** Wipes every session in the local SQLite store (relationships + conflicts). */
export const ClearDatabaseInputSchema = z.object({
  confirm: z.boolean().default(false),
});
export type ClearDatabaseInput = z.infer<typeof ClearDatabaseInputSchema>;

/** ---------------------------------------------------------------------
 * Turn-based debate state
 * ------------------------------------------------------------------- */

export const DebateTurnSchema = z.object({
  id: z.string().uuid(),
  conflictId: z.string().uuid(),
  turnIndex: z.number().int().min(1),
  speaker: SpeakerSchema,
  isDoubleTap: z.boolean(),
  userInterjection: z.string().optional(),
  utterance: z.string().optional(),
  createdAt: z.number().int(),
});
export type DebateTurn = z.infer<typeof DebateTurnSchema>;

export const ActiveConflictSchema = z.object({
  id: z.string().uuid(),
  /** Constraint/legacy brief for turn-mode performance (optional for older rows). */
  brief: DebateBriefSchema.optional(),
  sessionId: z.string(),
  domain: TopicDomainSchema,
  context: z.string(),
  topic: z.string().optional(),
  intensity: IntensitySchema,
  coreDisagreement: z.string(),
  angel: SidePositionSchema,
  devil: SidePositionSchema,
  likelyWinner: WinnerSchema,
  isRoleReversal: z.boolean(),
  absurdityLevel: z.number().min(0).max(1),
  continuity: ContinuitySchema,
  firstSpeaker: SpeakerSchema,
  lastSpeaker: SpeakerSchema.nullable(),
  nextSpeaker: SpeakerSchema,
  turnIndex: z.number().int().min(0),
  maxTurns: z.number().int().min(1),
  status: ActiveConflictStatusSchema,
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type ActiveConflict = z.infer<typeof ActiveConflictSchema>;

/** ---------------------------------------------------------------------
 * Misc helpers
 * ------------------------------------------------------------------- */

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}
