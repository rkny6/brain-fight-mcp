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

/**
 * Half-life for recency weighting, in days: an outcome's influence halves
 * every this many days. 60 days means something from 2 months ago still
 * counts at ~50% strength, a year-old outcome fades to a few percent —
 * present but no longer dominant. Weight never hits exactly zero, so
 * nothing is ever fully "forgotten," just faded.
 */
const RECENCY_HALF_LIFE_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

function recencyWeight(recordedAt: number, now: number): number {
  const ageDays = Math.max(0, (now - recordedAt) / DAY_MS);
  return Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
}

export interface MemorableOutcome {
  note: string;
  sentiment?: DecisionOutcome["sentiment"];
  recordedAt: number;
  /** How many days ago this was recorded — lets the caller phrase "last time" vs "a while back" honestly. */
  ageDays: number;
}

export interface TrackRecord {
  totalRecorded: number;
  angelChoiceCount: number;
  devilChoiceCount: number;
  angelChoiceGoodCount: number;
  angelChoiceRegretCount: number;
  devilChoiceGoodCount: number;
  devilChoiceRegretCount: number;
  /**
   * Recency-weighted versions of the same tallies (0-1 weight per outcome,
   * halving every RECENCY_HALF_LIFE_DAYS, summed). A regret from a year
   * ago barely moves these; one from last week moves them a lot. Use
   * these — not the raw counts above — to judge "how this currently
   * feels," since raw counts treat a one-time-long-ago slip the same as
   * something that just happened.
   */
  angelWeightedGood: number;
  angelWeightedRegret: number;
  devilWeightedGood: number;
  devilWeightedRegret: number;
  /**
   * A specific past outcome the user actually wrote a note about — concrete
   * ammo ("you said X, it turned into Y") instead of just aggregate counts.
   * Prefers the most recent outcome with a definite sentiment (good/regret)
   * over a vaguer one (mixed/too_early), but any note beats no note.
   */
  angelMemorableOutcome?: MemorableOutcome;
  devilMemorableOutcome?: MemorableOutcome;
}

/**
 * Picks the single most usable specific memory for one side: newest
 * outcome for that side with a non-empty note, preferring a definite
 * good/regret sentiment over a vague one. `outcomes` must be newest-first
 * (as returned by recallOutcomes/getRecentOutcomes).
 */
function pickMemorableOutcome(
  outcomes: DecisionOutcome[],
  side: "angel" | "devil",
  now: number,
): MemorableOutcome | undefined {
  const withNotes = outcomes.filter(
    (o) => o.actualChoice === side && o.outcomeNote && o.outcomeNote.trim().length > 0,
  );
  const definite = withNotes.find(
    (o) => o.sentiment === "good" || o.sentiment === "regret",
  );
  const chosen = definite ?? withNotes[0];
  if (!chosen) return undefined;
  return {
    note: chosen.outcomeNote as string,
    sentiment: chosen.sentiment,
    recordedAt: chosen.recordedAt,
    ageDays: Math.round(Math.max(0, (now - chosen.recordedAt) / DAY_MS)),
  };
}

/**
 * Lightweight tally of how "angel-leaning" vs "devil-leaning" choices have
 * actually gone for this user, based on recorded outcomes with a sentiment.
 * Raw counts are exact and simple ("2 good, 1 regret, ever"); the weighted
 * fields alongside them fade older outcomes toward (but never quite to)
 * zero, so a single regret from a year ago doesn't carry the same weight
 * as one from last week. Callers decide the scope by what list of
 * outcomes they pass in (one domain, or all of them for a cross-domain
 * summary). `now` is injectable for tests; defaults to the real clock.
 */
export function buildTrackRecord(
  outcomes: DecisionOutcome[],
  now: number = Date.now(),
): TrackRecord {
  const record: TrackRecord = {
    totalRecorded: outcomes.length,
    angelChoiceCount: 0,
    devilChoiceCount: 0,
    angelChoiceGoodCount: 0,
    angelChoiceRegretCount: 0,
    devilChoiceGoodCount: 0,
    devilChoiceRegretCount: 0,
    angelWeightedGood: 0,
    angelWeightedRegret: 0,
    devilWeightedGood: 0,
    devilWeightedRegret: 0,
    angelMemorableOutcome: pickMemorableOutcome(outcomes, "angel", now),
    devilMemorableOutcome: pickMemorableOutcome(outcomes, "devil", now),
  };

  for (const o of outcomes) {
    const weight = recencyWeight(o.recordedAt, now);
    if (o.actualChoice === "angel") {
      record.angelChoiceCount += 1;
      if (o.sentiment === "good") {
        record.angelChoiceGoodCount += 1;
        record.angelWeightedGood += weight;
      }
      if (o.sentiment === "regret") {
        record.angelChoiceRegretCount += 1;
        record.angelWeightedRegret += weight;
      }
    } else if (o.actualChoice === "devil") {
      record.devilChoiceCount += 1;
      if (o.sentiment === "good") {
        record.devilChoiceGoodCount += 1;
        record.devilWeightedGood += weight;
      }
      if (o.sentiment === "regret") {
        record.devilChoiceRegretCount += 1;
        record.devilWeightedRegret += weight;
      }
    }
  }

  record.angelWeightedGood = Math.round(record.angelWeightedGood * 100) / 100;
  record.angelWeightedRegret = Math.round(record.angelWeightedRegret * 100) / 100;
  record.devilWeightedGood = Math.round(record.devilWeightedGood * 100) / 100;
  record.devilWeightedRegret = Math.round(record.devilWeightedRegret * 100) / 100;

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
