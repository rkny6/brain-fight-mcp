import { randomUUID } from "node:crypto";
import { getDb } from "../database.js";
import type {
  ActiveConflict,
  ActiveConflictStatus,
  Continuity,
  DebateBrief,
  DebateTurn,
  Intensity,
  SidePosition,
  Speaker,
  TopicDomain,
  Winner,
} from "../../types/index.js";

interface ActiveConflictRow {
  id: string;
  session_id: string;
  domain: string;
  context: string;
  topic: string | null;
  intensity: string;
  core_disagreement: string;
  angel_json: string;
  devil_json: string;
  likely_winner: string | null;
  is_role_reversal: number;
  absurdity_level: number;
  continuity_json: string;
  brief_json: string | null;
  first_speaker: string;
  last_speaker: string | null;
  next_speaker: string;
  turn_index: number;
  max_turns: number;
  status: string;
  created_at: number;
  updated_at: number;
}

interface DebateTurnRow {
  id: string;
  conflict_id: string;
  turn_index: number;
  speaker: string;
  is_double_tap: number;
  user_interjection: string | null;
  utterance: string | null;
  created_at: number;
}

function rowToActive(row: ActiveConflictRow): ActiveConflict {
  return {
    id: row.id,
    sessionId: row.session_id,
    domain: row.domain as TopicDomain,
    context: row.context,
    topic: row.topic ?? undefined,
    intensity: row.intensity as Intensity,
    coreDisagreement: row.core_disagreement,
    angel: JSON.parse(row.angel_json) as SidePosition,
    devil: JSON.parse(row.devil_json) as SidePosition,
    likelyWinner: (row.likely_winner as Winner) ?? null,
    isRoleReversal: row.is_role_reversal === 1,
    absurdityLevel: row.absurdity_level,
    continuity: JSON.parse(row.continuity_json) as Continuity,
    brief: row.brief_json
      ? (JSON.parse(row.brief_json) as DebateBrief)
      : undefined,
    firstSpeaker: row.first_speaker as Speaker,
    lastSpeaker: (row.last_speaker as Speaker | null) ?? null,
    nextSpeaker: row.next_speaker as Speaker,
    turnIndex: row.turn_index,
    maxTurns: row.max_turns,
    status: row.status as ActiveConflictStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToTurn(row: DebateTurnRow): DebateTurn {
  return {
    id: row.id,
    conflictId: row.conflict_id,
    turnIndex: row.turn_index,
    speaker: row.speaker as Speaker,
    isDoubleTap: row.is_double_tap === 1,
    userInterjection: row.user_interjection ?? undefined,
    utterance: row.utterance ?? undefined,
    createdAt: row.created_at,
  };
}

export type CreateActiveConflictInput = Omit<
  ActiveConflict,
  "id" | "createdAt" | "updatedAt" | "status" | "turnIndex" | "lastSpeaker"
> & {
  id?: string;
  status?: ActiveConflictStatus;
  turnIndex?: number;
  lastSpeaker?: Speaker | null;
};

/** Marks any open conflict for the (session, domain) as abandoned (only one open debate per bucket). */
export function abandonOpenConflicts(sessionId: string, domain: TopicDomain): number {
  const db = getDb();
  const now = Date.now();
  const result = db
    .prepare(
      `UPDATE active_conflicts
       SET status = 'abandoned', updated_at = ?
       WHERE session_id = ? AND domain = ? AND status = 'open'`,
    )
    .run(now, sessionId, domain);
  return result.changes;
}

export function createActiveConflict(
  input: CreateActiveConflictInput,
): ActiveConflict {
  const db = getDb();
  const now = Date.now();
  const record: ActiveConflict = {
    id: input.id ?? randomUUID(),
    sessionId: input.sessionId,
    domain: input.domain,
    context: input.context,
    topic: input.topic,
    intensity: input.intensity,
    coreDisagreement: input.coreDisagreement,
    angel: input.angel,
    devil: input.devil,
    likelyWinner: input.likelyWinner,
    isRoleReversal: input.isRoleReversal,
    absurdityLevel: input.absurdityLevel,
    continuity: input.continuity,
    brief: input.brief,
    firstSpeaker: input.firstSpeaker,
    lastSpeaker: input.lastSpeaker ?? null,
    nextSpeaker: input.nextSpeaker,
    turnIndex: input.turnIndex ?? 0,
    maxTurns: input.maxTurns,
    status: input.status ?? "open",
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(
    `INSERT INTO active_conflicts (
       id, session_id, domain, context, topic, intensity, core_disagreement,
       angel_json, devil_json, likely_winner, is_role_reversal, absurdity_level,
       continuity_json, brief_json, first_speaker, last_speaker, next_speaker,
       turn_index, max_turns, status, created_at, updated_at
     ) VALUES (
       @id, @sessionId, @domain, @context, @topic, @intensity, @coreDisagreement,
       @angelJson, @devilJson, @likelyWinner, @isRoleReversal, @absurdityLevel,
       @continuityJson, @briefJson, @firstSpeaker, @lastSpeaker, @nextSpeaker,
       @turnIndex, @maxTurns, @status, @createdAt, @updatedAt
     )`,
  ).run({
    id: record.id,
    sessionId: record.sessionId,
    domain: record.domain,
    context: record.context,
    topic: record.topic ?? null,
    intensity: record.intensity,
    coreDisagreement: record.coreDisagreement,
    angelJson: JSON.stringify(record.angel),
    devilJson: JSON.stringify(record.devil),
    likelyWinner: record.likelyWinner,
    isRoleReversal: record.isRoleReversal ? 1 : 0,
    absurdityLevel: record.absurdityLevel,
    continuityJson: JSON.stringify(record.continuity),
    briefJson: record.brief ? JSON.stringify(record.brief) : null,
    firstSpeaker: record.firstSpeaker,
    lastSpeaker: record.lastSpeaker,
    nextSpeaker: record.nextSpeaker,
    turnIndex: record.turnIndex,
    maxTurns: record.maxTurns,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });

  return record;
}

export function getActiveConflictById(
  conflictId: string,
): ActiveConflict | null {
  const db = getDb();
  const row = db
    .prepare<[string], ActiveConflictRow>(
      "SELECT * FROM active_conflicts WHERE id = ?",
    )
    .get(conflictId);
  return row ? rowToActive(row) : null;
}

/** Newest open conflict for a session, if any. Pass a domain to scope it. */
export function getOpenActiveConflict(
  sessionId: string,
  domain?: TopicDomain,
): ActiveConflict | null {
  const db = getDb();
  if (domain) {
    const row = db
      .prepare<[string, string], ActiveConflictRow>(
        `SELECT * FROM active_conflicts
         WHERE session_id = ? AND domain = ? AND status = 'open'
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .get(sessionId, domain);
    return row ? rowToActive(row) : null;
  }
  const row = db
    .prepare<[string], ActiveConflictRow>(
      `SELECT * FROM active_conflicts
       WHERE session_id = ? AND status = 'open'
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .get(sessionId);
  return row ? rowToActive(row) : null;
}

export function saveActiveConflict(state: ActiveConflict): void {
  const db = getDb();
  db.prepare(
    `UPDATE active_conflicts SET
       context = @context,
       topic = @topic,
       intensity = @intensity,
       core_disagreement = @coreDisagreement,
       angel_json = @angelJson,
       devil_json = @devilJson,
       likely_winner = @likelyWinner,
       is_role_reversal = @isRoleReversal,
       absurdity_level = @absurdityLevel,
       continuity_json = @continuityJson,
       brief_json = @briefJson,
       first_speaker = @firstSpeaker,
       last_speaker = @lastSpeaker,
       next_speaker = @nextSpeaker,
       turn_index = @turnIndex,
       max_turns = @maxTurns,
       status = @status,
       updated_at = @updatedAt
     WHERE id = @id`,
  ).run({
    id: state.id,
    context: state.context,
    topic: state.topic ?? null,
    intensity: state.intensity,
    coreDisagreement: state.coreDisagreement,
    angelJson: JSON.stringify(state.angel),
    devilJson: JSON.stringify(state.devil),
    likelyWinner: state.likelyWinner,
    isRoleReversal: state.isRoleReversal ? 1 : 0,
    absurdityLevel: state.absurdityLevel,
    continuityJson: JSON.stringify(state.continuity),
    briefJson: state.brief ? JSON.stringify(state.brief) : null,
    firstSpeaker: state.firstSpeaker,
    lastSpeaker: state.lastSpeaker,
    nextSpeaker: state.nextSpeaker,
    turnIndex: state.turnIndex,
    maxTurns: state.maxTurns,
    status: state.status,
    updatedAt: state.updatedAt,
  });
}

export function appendDebateTurn(input: {
  conflictId: string;
  turnIndex: number;
  speaker: Speaker;
  isDoubleTap: boolean;
  userInterjection?: string;
  utterance?: string;
}): DebateTurn {
  const db = getDb();
  const turn: DebateTurn = {
    id: randomUUID(),
    conflictId: input.conflictId,
    turnIndex: input.turnIndex,
    speaker: input.speaker,
    isDoubleTap: input.isDoubleTap,
    userInterjection: input.userInterjection,
    utterance: input.utterance,
    createdAt: Date.now(),
  };

  db.prepare(
    `INSERT INTO debate_turns (
       id, conflict_id, turn_index, speaker, is_double_tap,
       user_interjection, utterance, created_at
     ) VALUES (
       @id, @conflictId, @turnIndex, @speaker, @isDoubleTap,
       @userInterjection, @utterance, @createdAt
     )`,
  ).run({
    id: turn.id,
    conflictId: turn.conflictId,
    turnIndex: turn.turnIndex,
    speaker: turn.speaker,
    isDoubleTap: turn.isDoubleTap ? 1 : 0,
    userInterjection: turn.userInterjection ?? null,
    utterance: turn.utterance ?? null,
    createdAt: turn.createdAt,
  });

  return turn;
}

export function listDebateTurns(conflictId: string): DebateTurn[] {
  const db = getDb();
  const rows = db
    .prepare<[string], DebateTurnRow>(
      `SELECT * FROM debate_turns
       WHERE conflict_id = ?
       ORDER BY turn_index ASC`,
    )
    .all(conflictId);
  return rows.map(rowToTurn);
}

/** Stores a performed line on an existing turn when utterance is still empty. */
export function updateDebateTurnUtterance(
  conflictId: string,
  turnIndex: number,
  utterance: string,
): void {
  const db = getDb();
  db.prepare(
    `UPDATE debate_turns
     SET utterance = ?
     WHERE conflict_id = ? AND turn_index = ? AND (utterance IS NULL OR utterance = '')`,
  ).run(utterance, conflictId, turnIndex);
}

/** Soft-deletes open debates + hard-deletes turns/active rows for a session. Pass a domain to scope it. */
export function deleteActiveConflictsForSession(
  sessionId: string,
  domain?: TopicDomain,
): void {
  const db = getDb();
  const clear = db.transaction(() => {
    const ids = domain
      ? db
          .prepare<[string, string], { id: string }>(
            "SELECT id FROM active_conflicts WHERE session_id = ? AND domain = ?",
          )
          .all(sessionId, domain)
          .map((r) => r.id)
      : db
          .prepare<[string], { id: string }>(
            "SELECT id FROM active_conflicts WHERE session_id = ?",
          )
          .all(sessionId)
          .map((r) => r.id);

    if (ids.length === 0) {
      return;
    }

    const placeholders = ids.map(() => "?").join(", ");
    db.prepare(
      `DELETE FROM debate_turns WHERE conflict_id IN (${placeholders})`,
    ).run(...ids);
    db.prepare(
      `DELETE FROM active_conflicts WHERE id IN (${placeholders})`,
    ).run(...ids);
  });
  clear();
}

export function deleteAllActiveConflicts(): {
  activeConflictsDeleted: number;
  debateTurnsDeleted: number;
} {
  const db = getDb();
  return db.transaction(() => {
    const turns = db.prepare("DELETE FROM debate_turns").run();
    const active = db.prepare("DELETE FROM active_conflicts").run();
    return {
      activeConflictsDeleted: active.changes,
      debateTurnsDeleted: turns.changes,
    };
  })();
}

/**
 * Removes rows from active_conflicts/debate_turns that have stopped being
 * useful. Durable history caps for `conflicts` / `decision_outcomes` live in
 * `retention.ts` (`pruneDurableHistory` / `runStorageMaintenance`).
 *
 * What gets pruned here:
 *  - 'abandoned' rows, always. They were superseded the moment a newer
 *    debate opened in the same (session, domain) bucket, never produced a
 *    `conflicts` record, and nothing reads them back — pure clutter from
 *    the first message. (Zombie `open` rows may be marked abandoned first
 *    by `abandonStaleOpenConflicts` in retention.ts.)
 *  - 'completed' rows older than `completedRetentionMs` (default 14 days,
 *    overridable via `BRAIN_FIGHT_RETENTION_DAYS`). Their durable summary
 *    (context, positions, winner) already lives in `conflicts`; what's
 *    being pruned here is just the raw turn-by-turn transcript, which
 *    nothing currently re-reads once end_inner_conflict has returned it.
 *  - 'open' rows are NOT deleted by this function alone — call
 *    `runStorageMaintenance` (or abandon then prune) for idle open cleanup.
 *
 * Prefer `runStorageMaintenance()` from start_debate; this lower-level
 * helper remains for tests and targeted active-table cleanup.
 */
function resolveCompletedRetentionMs(): number {
  const raw = process.env.BRAIN_FIGHT_RETENTION_DAYS;
  const DEFAULT_DAYS = 14;
  if (!raw) return DEFAULT_DAYS * 24 * 60 * 60 * 1000;
  const days = Number(raw);
  if (!Number.isFinite(days) || days <= 0) {
    return DEFAULT_DAYS * 24 * 60 * 60 * 1000;
  }
  return days * 24 * 60 * 60 * 1000;
}

export function pruneStaleActiveConflicts(
  completedRetentionMs: number = resolveCompletedRetentionMs(),
): { activeConflictsDeleted: number; debateTurnsDeleted: number } {
  const db = getDb();
  const completedCutoff = Date.now() - completedRetentionMs;

  return db.transaction(() => {
    const staleIds = db
      .prepare<[number], { id: string }>(
        `SELECT id FROM active_conflicts
         WHERE status = 'abandoned'
            OR (status = 'completed' AND updated_at < ?)`,
      )
      .all(completedCutoff)
      .map((r) => r.id);

    if (staleIds.length === 0) {
      return { activeConflictsDeleted: 0, debateTurnsDeleted: 0 };
    }

    const placeholders = staleIds.map(() => "?").join(", ");
    const turns = db
      .prepare(`DELETE FROM debate_turns WHERE conflict_id IN (${placeholders})`)
      .run(...staleIds);
    const active = db
      .prepare(`DELETE FROM active_conflicts WHERE id IN (${placeholders})`)
      .run(...staleIds);

    return {
      activeConflictsDeleted: active.changes,
      debateTurnsDeleted: turns.changes,
    };
  })();
}
