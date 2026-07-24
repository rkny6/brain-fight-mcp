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

/** ---------------------------------------------------------------------
 * Character Profile
 * ------------------------------------------------------------------- */

export const CharacterProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  archetype: ArchetypeSchema,
  traits: z.array(z.string()),
  values: z.array(z.string()),
  speakingStyle: z.string(),
  intensity: z.number().min(0).max(1),
});
export type CharacterProfile = z.infer<typeof CharacterProfileSchema>;

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
  angelRespect: z.number().min(0).max(1),
  devilRespect: z.number().min(0).max(1),
  angelAnnoyance: z.number().min(0).max(1),
  devilAnnoyance: z.number().min(0).max(1),
  cooperation: z.number().min(0).max(1),
  recentWinner: WinnerSchema,
  totalConflicts: z.number().int().min(0),
});
export type RelationshipState = z.infer<typeof RelationshipStateSchema>;

/** Defaults used when a session has no row yet (mirrors the SQL DEFAULTs). */
export const DEFAULT_RELATIONSHIP_STATE: Omit<RelationshipState, "sessionId"> = {
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

export const ConflictEngineOutputSchema = z.object({
  angel: SidePositionSchema,
  devil: SidePositionSchema,
  coreDisagreement: z.string(),
  likelyWinner: WinnerSchema,
  isRoleReversal: z.boolean(),
  absurdityLevel: z.number().min(0).max(1),
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

export const StartConflictInputSchema = z.object({
  context: z.string().min(1, "context is required"),
  topic: z.string().optional(),
  intensity: IntensitySchema.default("medium"),
  sessionId: z.string().default("default"),
});
export type StartConflictInput = z.infer<typeof StartConflictInputSchema>;

export const GetRelationshipInputSchema = z.object({
  sessionId: z.string().default("default"),
});
export type GetRelationshipInput = z.infer<typeof GetRelationshipInputSchema>;

export const ResetRelationshipInputSchema = z.object({
  sessionId: z.string().default("default"),
  confirm: z.boolean().default(false),
});
export type ResetRelationshipInput = z.infer<typeof ResetRelationshipInputSchema>;

/** ---------------------------------------------------------------------
 * Misc helpers
 * ------------------------------------------------------------------- */

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}
