import type {
  ConflictRecord,
  MilestoneHit,
  MilestoneKey,
  RelationshipState,
} from "../types/index.js";

export interface DetectMilestonesInput {
  before: RelationshipState;
  after: RelationshipState;
  /** Newest-first conflict history for this (session, domain), from AFTER this round was saved. */
  recentConflicts: ConflictRecord[];
  /** Keys already fired for this bucket — never re-detected. */
  alreadyReached: ReadonlySet<MilestoneKey>;
}

const STREAK_LENGTH = 5;
const CONFLICTS_MILESTONE = 10;
const HIGH_COOPERATION_THRESHOLD = 0.9;

function hasWinStreak(
  recentConflicts: ConflictRecord[],
  side: "angel" | "devil",
): boolean {
  if (recentConflicts.length < STREAK_LENGTH) return false;
  return recentConflicts
    .slice(0, STREAK_LENGTH)
    .every((c) => c.winner === side);
}

/**
 * Detects rare, one-time narrative beats crossed by THIS round's result.
 * Pure and deterministic — no DB access, no randomness. Keep this list
 * short and genuinely rare: the value is in surprise, and a milestone
 * that fires constantly stops being one.
 */
export function detectNewMilestones(
  input: DetectMilestonesInput,
): MilestoneHit[] {
  const { before, after, recentConflicts, alreadyReached } = input;
  const hits: MilestoneHit[] = [];

  const consider = (key: MilestoneKey, note: string) => {
    if (!alreadyReached.has(key)) {
      hits.push({ key, note });
    }
  };

  if (
    after.cooperation >= HIGH_COOPERATION_THRESHOLD &&
    before.cooperation < HIGH_COOPERATION_THRESHOLD
  ) {
    consider(
      "high_cooperation",
      "Cooperation has just crossed a rare high-agreement threshold for the first time in this domain — Angel and Devil are, unusually, mostly on the same page right now.",
    );
  }

  if (hasWinStreak(recentConflicts, "devil")) {
    consider(
      "devil_streak_5",
      `Devil has now won ${STREAK_LENGTH} debates in a row in this domain for the first time — an unusual, lopsided streak.`,
    );
  }

  if (hasWinStreak(recentConflicts, "angel")) {
    consider(
      "angel_streak_5",
      `Angel has now won ${STREAK_LENGTH} debates in a row in this domain for the first time — an unusual, lopsided streak.`,
    );
  }

  if (
    after.totalConflicts === CONFLICTS_MILESTONE &&
    before.totalConflicts < CONFLICTS_MILESTONE
  ) {
    consider(
      "conflicts_10",
      `This is the 10th completed debate in this domain — a small "we've been doing this a while" milestone.`,
    );
  }

  return hits;
}
