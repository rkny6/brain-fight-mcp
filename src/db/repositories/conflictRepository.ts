import { randomUUID } from "node:crypto";
import { getDb } from "../database.js";
import type { ConflictRecord, Winner } from "../../types/index.js";

interface ConflictRow {
  id: string;
  session_id: string;
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
       id, session_id, context, topic,
       angel_position, devil_position, winner,
       absurdity_level, created_at
     ) VALUES (@id, @sessionId, @context, @topic, @angelPosition, @devilPosition, @winner, @absurdityLevel, @createdAt)`
  ).run({ ...record, topic: record.topic ?? null, winner: record.winner });

  return record;
}

/** Retrieves the most recent conflicts for a session, newest first. */
export function getRecentConflicts(
  sessionId: string,
  limit = 5
): ConflictRecord[] {
  const db = getDb();
  const rows = db
    .prepare<[string, number], ConflictRow>(
      "SELECT * FROM conflicts WHERE session_id = ? ORDER BY created_at DESC LIMIT ?"
    )
    .all(sessionId, limit);
  return rows.map(rowToRecord);
}

/** Deletes all conflicts for a session (used by reset_relationship). */
export function deleteConflicts(sessionId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM conflicts WHERE session_id = ?").run(sessionId);
}
