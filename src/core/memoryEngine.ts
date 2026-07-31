import {
  deleteConflicts,
  getConflictById,
  getRecentConflicts,
  saveConflict,
  type SaveConflictInput,
} from "../db/repositories/conflictRepository.js";
import {
  deleteOutcomes,
  getRecentOutcomes,
  saveOutcome,
  type SaveOutcomeInput,
} from "../db/repositories/outcomeRepository.js";
import type { ConflictRecord, DecisionOutcome, TopicDomain } from "../types/index.js";

/** Persists a finished conflict to SQLite. */
export function remember(input: SaveConflictInput): ConflictRecord {
  return saveConflict(input);
}

/**
 * Retrieves the most recent conflicts for a session (default: last 5).
 * Pass a domain to scope to just that bucket; omit for all domains.
 */
export function recall(
  sessionId: string,
  limit = 5,
  domain?: TopicDomain,
): ConflictRecord[] {
  return getRecentConflicts(sessionId, limit, domain);
}

/**
 * Direct lookup for a specific conflict.id within a session. Use this to
 * validate a conflict reference (e.g. before recording an outcome for it)
 * instead of scanning the "recent N" list, which goes stale once a
 * session has more than N conflicts since.
 */
export function recallConflictById(
  conflictId: string,
  sessionId: string,
): ConflictRecord | null {
  return getConflictById(conflictId, sessionId);
}

/** Persists a user-reported outcome for a previously closed conflict. */
export function rememberOutcome(input: SaveOutcomeInput): DecisionOutcome {
  return saveOutcome(input);
}

/**
 * Retrieves the most recent recorded outcomes for a session.
 * Pass a domain to scope to just that bucket; omit for all domains.
 */
export function recallOutcomes(
  sessionId: string,
  limit = 10,
  domain?: TopicDomain,
): DecisionOutcome[] {
  return getRecentOutcomes(sessionId, limit, domain);
}

export interface TrackRecord {
  totalRecorded: number;
  angelChoiceCount: number;
  devilChoiceCount: number;
  angelChoiceGoodCount: number;
  angelChoiceRegretCount: number;
  devilChoiceGoodCount: number;
  devilChoiceRegretCount: number;
}

/**
 * Lightweight tally of how "angel-leaning" vs "devil-leaning" choices have
 * actually gone for this user, based on recorded outcomes with a sentiment.
 * This is intentionally simple (counts, not statistics) — it exists to
 * ground a sentence like "the last 3 times you went with Devil's push, 2
 * turned into regret" rather than to be a rigorous model of anything.
 * Callers decide the scope by what list of outcomes they pass in (one
 * domain, or all of them for a cross-domain summary).
 */
export function buildTrackRecord(outcomes: DecisionOutcome[]): TrackRecord {
  const record: TrackRecord = {
    totalRecorded: outcomes.length,
    angelChoiceCount: 0,
    devilChoiceCount: 0,
    angelChoiceGoodCount: 0,
    angelChoiceRegretCount: 0,
    devilChoiceGoodCount: 0,
    devilChoiceRegretCount: 0,
  };

  for (const o of outcomes) {
    if (o.actualChoice === "angel") {
      record.angelChoiceCount += 1;
      if (o.sentiment === "good") record.angelChoiceGoodCount += 1;
      if (o.sentiment === "regret") record.angelChoiceRegretCount += 1;
    } else if (o.actualChoice === "devil") {
      record.devilChoiceCount += 1;
      if (o.sentiment === "good") record.devilChoiceGoodCount += 1;
      if (o.sentiment === "regret") record.devilChoiceRegretCount += 1;
    }
  }

  return record;
}

/**
 * Wipes conflict memory (and any recorded outcomes) for a session.
 * Pass a domain to scope the wipe to just that bucket; omit to wipe
 * every domain for the session (matches the old pre-domain behavior).
 */
export function forget(sessionId: string, domain?: TopicDomain): void {
  deleteConflicts(sessionId, domain);
  deleteOutcomes(sessionId, domain);
}
