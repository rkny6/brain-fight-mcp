import { getDb } from "../database.js";
import {
  DEFAULT_RELATIONSHIP_STATE,
  type RelationshipState,
  type Winner,
} from "../../types/index.js";

interface RelationshipRow {
  session_id: string;
  angel_respect: number;
  devil_respect: number;
  angel_annoyance: number;
  devil_annoyance: number;
  cooperation: number;
  recent_winner: string | null;
  total_conflicts: number;
}

function rowToState(row: RelationshipRow): RelationshipState {
  return {
    sessionId: row.session_id,
    angelRespect: row.angel_respect,
    devilRespect: row.devil_respect,
    angelAnnoyance: row.angel_annoyance,
    devilAnnoyance: row.devil_annoyance,
    cooperation: row.cooperation,
    recentWinner: (row.recent_winner as Winner) ?? null,
    totalConflicts: row.total_conflicts,
  };
}

/** Fetches relationship state for a session, creating a default row if absent. */
export function getOrCreateRelationship(sessionId: string): RelationshipState {
  const db = getDb();

  const existing = db
    .prepare<[string], RelationshipRow>(
      "SELECT * FROM relationship_state WHERE session_id = ?"
    )
    .get(sessionId);

  if (existing) {
    return rowToState(existing);
  }

  db.prepare(
    `INSERT INTO relationship_state (
       session_id, angel_respect, devil_respect,
       angel_annoyance, devil_annoyance, cooperation,
       recent_winner, total_conflicts
     ) VALUES (@sessionId, @angelRespect, @devilRespect, @angelAnnoyance, @devilAnnoyance, @cooperation, @recentWinner, @totalConflicts)`
  ).run({
    sessionId,
    ...DEFAULT_RELATIONSHIP_STATE,
    recentWinner: DEFAULT_RELATIONSHIP_STATE.recentWinner,
  });

  return { sessionId, ...DEFAULT_RELATIONSHIP_STATE };
}

/** Persists a full relationship state (upsert). */
export function saveRelationship(state: RelationshipState): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO relationship_state (
       session_id, angel_respect, devil_respect,
       angel_annoyance, devil_annoyance, cooperation,
       recent_winner, total_conflicts
     ) VALUES (@sessionId, @angelRespect, @devilRespect, @angelAnnoyance, @devilAnnoyance, @cooperation, @recentWinner, @totalConflicts)
     ON CONFLICT(session_id) DO UPDATE SET
       angel_respect = excluded.angel_respect,
       devil_respect = excluded.devil_respect,
       angel_annoyance = excluded.angel_annoyance,
       devil_annoyance = excluded.devil_annoyance,
       cooperation = excluded.cooperation,
       recent_winner = excluded.recent_winner,
       total_conflicts = excluded.total_conflicts`
  ).run(state);
}

/** Deletes the relationship row for a session (used by reset_relationship). */
export function deleteRelationship(sessionId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM relationship_state WHERE session_id = ?").run(sessionId);
}
