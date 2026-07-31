import { randomUUID } from "node:crypto";
import { getDb } from "../database.js";
import type {
  ActualChoice,
  DecisionOutcome,
  OutcomeSentiment,
  TopicDomain,
} from "../../types/index.js";

interface OutcomeRow {
  id: string;
  conflict_id: string;
  session_id: string;
  domain: string;
  actual_choice: string;
  outcome_note: string | null;
  sentiment: string | null;
  recorded_at: number;
}

function rowToRecord(row: OutcomeRow): DecisionOutcome {
  return {
    id: row.id,
    conflictId: row.conflict_id,
    sessionId: row.session_id,
    domain: row.domain as TopicDomain,
    actualChoice: row.actual_choice as ActualChoice,
    outcomeNote: row.outcome_note ?? undefined,
    sentiment: (row.sentiment as OutcomeSentiment | null) ?? undefined,
    recordedAt: row.recorded_at,
  };
}

export interface SaveOutcomeInput {
  conflictId: string;
  sessionId: string;
  /** Denormalized from the parent conflict at insert time, not caller-supplied. */
  domain: TopicDomain;
  actualChoice: ActualChoice;
  outcomeNote?: string;
  sentiment?: OutcomeSentiment;
}

/**
 * Inserts a new outcome row. A conflict can accumulate more than one
 * outcome record over time (e.g. "decided X" now, "here's how it went"
 * weeks later) — callers that want a single up-to-date record should
 * fetch the most recent one via getLatestOutcomeForConflict.
 */
export function saveOutcome(input: SaveOutcomeInput): DecisionOutcome {
  const db = getDb();
  const record: DecisionOutcome = {
    id: randomUUID(),
    conflictId: input.conflictId,
    sessionId: input.sessionId,
    domain: input.domain,
    actualChoice: input.actualChoice,
    outcomeNote: input.outcomeNote,
    sentiment: input.sentiment,
    recordedAt: Date.now(),
  };

  db.prepare(
    `INSERT INTO decision_outcomes (
       id, conflict_id, session_id, domain, actual_choice, outcome_note, sentiment, recorded_at
     ) VALUES (@id, @conflictId, @sessionId, @domain, @actualChoice, @outcomeNote, @sentiment, @recordedAt)`,
  ).run({
    ...record,
    outcomeNote: record.outcomeNote ?? null,
    sentiment: record.sentiment ?? null,
  });

  return record;
}

/** Most recent outcomes for a session, newest first. Pass a domain to scope it. */
export function getRecentOutcomes(
  sessionId: string,
  limit = 10,
  domain?: TopicDomain,
): DecisionOutcome[] {
  const db = getDb();
  if (domain) {
    const rows = db
      .prepare<[string, string, number], OutcomeRow>(
        "SELECT * FROM decision_outcomes WHERE session_id = ? AND domain = ? ORDER BY recorded_at DESC LIMIT ?",
      )
      .all(sessionId, domain, limit);
    return rows.map(rowToRecord);
  }
  const rows = db
    .prepare<[string, number], OutcomeRow>(
      "SELECT * FROM decision_outcomes WHERE session_id = ? ORDER BY recorded_at DESC LIMIT ?",
    )
    .all(sessionId, limit);
  return rows.map(rowToRecord);
}

/** Latest recorded outcome for a specific conflict, if any. */
export function getLatestOutcomeForConflict(
  conflictId: string,
): DecisionOutcome | null {
  const db = getDb();
  const row = db
    .prepare<[string], OutcomeRow>(
      "SELECT * FROM decision_outcomes WHERE conflict_id = ? ORDER BY recorded_at DESC LIMIT 1",
    )
    .get(conflictId);
  return row ? rowToRecord(row) : null;
}

/** Deletes outcomes for a session (used by reset_relationship). Pass a domain to scope it. */
export function deleteOutcomes(sessionId: string, domain?: TopicDomain): void {
  const db = getDb();
  if (domain) {
    db.prepare("DELETE FROM decision_outcomes WHERE session_id = ? AND domain = ?").run(
      sessionId,
      domain,
    );
  } else {
    db.prepare("DELETE FROM decision_outcomes WHERE session_id = ?").run(sessionId);
  }
}
