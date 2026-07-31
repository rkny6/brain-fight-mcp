import { randomUUID } from "node:crypto";
import { getDb } from "../database.js";
import type { ConflictRecord, TopicDomain, Winner } from "../../types/index.js";

interface ConflictRow {
  id: string;
  session_id: string;
  domain: string;
  context: string;
  topic: string | null;
  angel_position: string;
  devil_position: string;
  winner: string | null;
  absurdity_level: number;
  created_at: number;
}

function rowToRecord(row: ConflictRow): ConflictRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    domain: row.domain as TopicDomain,
    context: row.context,
    topic: row.topic ?? undefined,
    angelPosition: row.angel_position,
    devilPosition: row.devil_position,
    winner: (row.winner as Winner) ?? null,
    absurdityLevel: row.absurdity_level,
    createdAt: row.created_at,
  };
}

export interface SaveConflictInput {
  sessionId: string;
  domain: TopicDomain;
  context: string;
  topic?: string;
  angelPosition: string;
  devilPosition: string;
  winner: Winner;
  absurdityLevel: number;
}

/** Inserts a new conflict record and returns the generated record. */
export function saveConflict(input: SaveConflictInput): ConflictRecord {
  const db = getDb();
  const record: ConflictRecord = {
    id: randomUUID(),
    sessionId: input.sessionId,
    domain: input.domain,
    context: input.context,
    topic: input.topic,
    angelPosition: input.angelPosition,
    devilPosition: input.devilPosition,
    winner: input.winner,
    absurdityLevel: input.absurdityLevel,
    createdAt: Date.now(),
  };

  db.prepare(
    `INSERT INTO conflicts (
       id, session_id, domain, context, topic,
       angel_position, devil_position, winner,
       absurdity_level, created_at
     ) VALUES (@id, @sessionId, @domain, @context, @topic, @angelPosition, @devilPosition, @winner, @absurdityLevel, @createdAt)`
  ).run({ ...record, topic: record.topic ?? null, winner: record.winner });

  return record;
}

/** Retrieves the most recent conflicts for a session, newest first. Pass a domain to scope it. */
export function getRecentConflicts(
  sessionId: string,
  limit = 5,
  domain?: TopicDomain,
): ConflictRecord[] {
  const db = getDb();
  if (domain) {
    const rows = db
      .prepare<[string, string, number], ConflictRow>(
        "SELECT * FROM conflicts WHERE session_id = ? AND domain = ? ORDER BY created_at DESC LIMIT ?"
      )
      .all(sessionId, domain, limit);
    return rows.map(rowToRecord);
  }
  const rows = db
    .prepare<[string, number], ConflictRow>(
      "SELECT * FROM conflicts WHERE session_id = ? ORDER BY created_at DESC LIMIT ?"
    )
    .all(sessionId, limit);
  return rows.map(rowToRecord);
}

/**
 * Direct primary-key lookup, scoped to a session. Use this (not
 * getRecentConflicts + .find) to check whether a specific conflict.id
 * exists — "recent N" is an approximation that silently goes stale once
 * a session accumulates more than N conflicts, which would incorrectly
 * reject outcomes reported for genuinely real but older conflicts.
 */
export function getConflictById(
  id: string,
  sessionId: string
): ConflictRecord | null {
  const db = getDb();
  const row = db
    .prepare<[string, string], ConflictRow>(
      "SELECT * FROM conflicts WHERE id = ? AND session_id = ?"
    )
    .get(id, sessionId);
  return row ? rowToRecord(row) : null;
}

/** Deletes conflicts for a session (used by reset_relationship). Pass a domain to scope it. */
export function deleteConflicts(sessionId: string, domain?: TopicDomain): void {
  const db = getDb();
  if (domain) {
    db.prepare("DELETE FROM conflicts WHERE session_id = ? AND domain = ?").run(
      sessionId,
      domain,
    );
  } else {
    db.prepare("DELETE FROM conflicts WHERE session_id = ?").run(sessionId);
  }
}
