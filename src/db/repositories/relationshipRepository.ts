import { getDb } from "../database.js";
import {
  DEFAULT_RELATIONSHIP_STATE,
  DEFAULT_TOPIC_DOMAIN,
  type RelationshipState,
  type TopicDomain,
  type Winner,
} from "../../types/index.js";

interface RelationshipRow {
  session_id: string;
  domain: string;
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
    domain: row.domain as TopicDomain,
    angelRespect: row.angel_respect,
    devilRespect: row.devil_respect,
    angelAnnoyance: row.angel_annoyance,
    devilAnnoyance: row.devil_annoyance,
    cooperation: row.cooperation,
    recentWinner: (row.recent_winner as Winner) ?? null,
    totalConflicts: row.total_conflicts,
  };
}

/** Fetches relationship state for a (session, domain) bucket, creating a default row if absent. */
export function getOrCreateRelationship(
  sessionId: string,
  domain: TopicDomain = DEFAULT_TOPIC_DOMAIN,
): RelationshipState {
  const db = getDb();

  const existing = db
    .prepare<[string, string], RelationshipRow>(
      "SELECT * FROM relationship_state WHERE session_id = ? AND domain = ?"
    )
    .get(sessionId, domain);

  if (existing) {
    return rowToState(existing);
  }

  db.prepare(
    `INSERT INTO relationship_state (
       session_id, domain, angel_respect, devil_respect,
       angel_annoyance, devil_annoyance, cooperation,
       recent_winner, total_conflicts
     ) VALUES (@sessionId, @domain, @angelRespect, @devilRespect, @angelAnnoyance, @devilAnnoyance, @cooperation, @recentWinner, @totalConflicts)`
  ).run({
    sessionId,
    domain,
    ...DEFAULT_RELATIONSHIP_STATE,
    recentWinner: DEFAULT_RELATIONSHIP_STATE.recentWinner,
  });

  return { sessionId, domain, ...DEFAULT_RELATIONSHIP_STATE };
}

/** Persists a full relationship state for its (sessionId, domain) bucket (upsert). */
export function saveRelationship(state: RelationshipState): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO relationship_state (
       session_id, domain, angel_respect, devil_respect,
       angel_annoyance, devil_annoyance, cooperation,
       recent_winner, total_conflicts
     ) VALUES (@sessionId, @domain, @angelRespect, @devilRespect, @angelAnnoyance, @devilAnnoyance, @cooperation, @recentWinner, @totalConflicts)
     ON CONFLICT(session_id, domain) DO UPDATE SET
       angel_respect = excluded.angel_respect,
       devil_respect = excluded.devil_respect,
       angel_annoyance = excluded.angel_annoyance,
       devil_annoyance = excluded.devil_annoyance,
       cooperation = excluded.cooperation,
       recent_winner = excluded.recent_winner,
       total_conflicts = excluded.total_conflicts`
  ).run(state);
}

/** Every domain bucket that has any state for this session, for cross-domain summaries. */
export function getAllRelationshipsForSession(
  sessionId: string,
): RelationshipState[] {
  const db = getDb();
  const rows = db
    .prepare<[string], RelationshipRow>(
      "SELECT * FROM relationship_state WHERE session_id = ? ORDER BY total_conflicts DESC"
    )
    .all(sessionId);
  return rows.map(rowToState);
}

/**
 * Deletes relationship row(s) for a session (used by reset_relationship).
 * Pass a domain to reset just that bucket; omit to wipe every domain for
 * the session (matches the old pre-domain "reset everything" behavior).
 */
export function deleteRelationship(sessionId: string, domain?: TopicDomain): void {
  const db = getDb();
  if (domain) {
    db.prepare("DELETE FROM relationship_state WHERE session_id = ? AND domain = ?").run(
      sessionId,
      domain,
    );
  } else {
    db.prepare("DELETE FROM relationship_state WHERE session_id = ?").run(sessionId);
  }
}
