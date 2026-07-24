import { clamp, type RelationshipState, type Winner } from "../types/index.js";

const ANGEL_WIN_RESPECT_DELTA = 0.02;
const ANGEL_WIN_DEVIL_ANNOYANCE_DELTA = 0.03;
const DEVIL_WIN_RESPECT_DELTA = 0.02;
const DEVIL_WIN_ANGEL_ANNOYANCE_DELTA = 0.03;
const DRAW_COOPERATION_DELTA = 0.05;
const ROLE_REVERSAL_COOPERATION_BONUS = 0.02;

export interface ApplyConflictResultParams {
  relationship: RelationshipState;
  winner: Winner;
  isRoleReversal: boolean;
}

/**
 * Applies the deterministic relationship update rules for a finished
 * conflict and returns a brand-new state object (does not mutate input).
 *
 * Rules:
 *  - Angel wins: angelRespect += 0.02, devilAnnoyance += 0.03
 *  - Devil wins: devilRespect += 0.02, angelAnnoyance += 0.03
 *  - Draw: cooperation += 0.05
 *  - Role reversal occurred: cooperation += 0.02 (bonus, stacks with the above)
 * All values are clamped to [0, 1].
 */
export function applyConflictResult({
  relationship,
  winner,
  isRoleReversal,
}: ApplyConflictResultParams): RelationshipState {
  let {
    angelRespect,
    devilRespect,
    angelAnnoyance,
    devilAnnoyance,
    cooperation,
  } = relationship;

  if (winner === "angel") {
    angelRespect += ANGEL_WIN_RESPECT_DELTA;
    devilAnnoyance += ANGEL_WIN_DEVIL_ANNOYANCE_DELTA;
  } else if (winner === "devil") {
    devilRespect += DEVIL_WIN_RESPECT_DELTA;
    angelAnnoyance += DEVIL_WIN_ANGEL_ANNOYANCE_DELTA;
  } else if (winner === "draw") {
    cooperation += DRAW_COOPERATION_DELTA;
  }

  if (isRoleReversal) {
    cooperation += ROLE_REVERSAL_COOPERATION_BONUS;
  }

  return {
    ...relationship,
    angelRespect: clamp(angelRespect),
    devilRespect: clamp(devilRespect),
    angelAnnoyance: clamp(angelAnnoyance),
    devilAnnoyance: clamp(devilAnnoyance),
    cooperation: clamp(cooperation),
    recentWinner: winner,
    totalConflicts: relationship.totalConflicts + 1,
  };
}
