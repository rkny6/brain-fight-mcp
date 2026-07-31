import { getDb } from "../database.js";
import { pruneStaleActiveConflicts } from "./activeConflictRepository.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Default days before a still-`open` debate is treated as abandoned zombie state. */
const DEFAULT_OPEN_STALE_DAYS = 7;
/** Default max finished conflicts kept per (sessionId, domain). */
const DEFAULT_HISTORY_KEEP = 50;
/** Default max decision outcomes kept per (sessionId, domain). */
const DEFAULT_OUTCOME_KEEP = 50;
/**
 * When BRAIN_FIGHT_VACUUM is unset/`auto`, only VACUUM after at least this many
 * rows were deleted in one maintenance pass (VACUUM rewrites the whole file).
 */
const DEFAULT_VACUUM_MIN_DELETED = 25;

function parsePositiveNumber(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Math.floor(parsePositiveNumber(raw, fallback));
  return n > 0 ? n : fallback;
}

export function resolveOpenStaleMs(): number {
  return (
    parsePositiveNumber(process.env.BRAIN_FIGHT_OPEN_STALE_DAYS, DEFAULT_OPEN_STALE_DAYS) *
    DAY_MS
  );
}

export function resolveHistoryKeep(): number {
  return parsePositiveInt(process.env.BRAIN_FIGHT_HISTORY_KEEP, DEFAULT_HISTORY_KEEP);
}

export function resolveOutcomeKeep(): number {
  return parsePositiveInt(process.env.BRAIN_FIGHT_OUTCOME_KEEP, DEFAULT_OUTCOME_KEEP);
}

/**
 * Marks long-idle `open` debates as `abandoned` so the normal active prune can
 * hard-delete them. Live debates that are still being continued stay open.
 */
export function abandonStaleOpenConflicts(
  openStaleMs: number = resolveOpenStaleMs(),
): number {
  const db = getDb();
  const cutoff = Date.now() - openStaleMs;
  const now = Date.now();
  const result = db
    .prepare(
      `UPDATE active_conflicts
       SET status = 'abandoned', updated_at = ?
       WHERE status = 'open' AND updated_at < ?`,
    )
    .run(now, cutoff);
  return result.changes;
}

/**
 * Caps durable history so `conflicts` / `decision_outcomes` cannot grow without
 * bound. Keeps the newest N rows per (session_id, domain). Deleting conflicts
 * also cascades their outcomes via FK.
 *
 * Does NOT touch relationship_state (one row per bucket, already bounded).
 */
export function pruneDurableHistory(
  historyKeep: number = resolveHistoryKeep(),
  outcomeKeep: number = resolveOutcomeKeep(),
): { conflictsDeleted: number; decisionOutcomesDeleted: number } {
  const db = getDb();
  const keepConflicts = Math.max(1, Math.floor(historyKeep));
  const keepOutcomes = Math.max(1, Math.floor(outcomeKeep));

  return db.transaction(() => {
    // Outcomes first for rows that will be removed only by the outcome cap
    // (multiple outcomes can exist per conflict). Conflict deletes cascade too.
    const outcomes = db
      .prepare(
        `DELETE FROM decision_outcomes
         WHERE id IN (
           SELECT id FROM (
             SELECT id,
                    ROW_NUMBER() OVER (
                      PARTITION BY session_id, domain
                      ORDER BY recorded_at DESC, id DESC
                    ) AS rn
             FROM decision_outcomes
           ) ranked
           WHERE rn > ?
         )`,
      )
      .run(keepOutcomes);

    const conflicts = db
      .prepare(
        `DELETE FROM conflicts
         WHERE id IN (
           SELECT id FROM (
             SELECT id,
                    ROW_NUMBER() OVER (
                      PARTITION BY session_id, domain
                      ORDER BY created_at DESC, id DESC
                    ) AS rn
             FROM conflicts
           ) ranked
           WHERE rn > ?
         )`,
      )
      .run(keepConflicts);

    // Cascade may have already removed some outcomes; any leftover outcomes
    // pointing at deleted conflicts should be gone via FK. Re-run outcome cap
    // is unnecessary — one pass is enough.

    return {
      conflictsDeleted: conflicts.changes,
      decisionOutcomesDeleted: outcomes.changes,
    };
  })();
}

/**
 * Optionally runs SQLite VACUUM to reclaim freelist pages after deletes.
 *
 * - `BRAIN_FIGHT_VACUUM=0|false|off` → never
 * - `BRAIN_FIGHT_VACUUM=1|true|on` → whenever deletedRows > 0
 * - unset / `auto` → only when deletedRows >= BRAIN_FIGHT_VACUUM_MIN_DELETED
 *   (default 25), so routine single-row cleanups stay cheap
 */
export function maybeVacuum(deletedRows: number): boolean {
  if (deletedRows <= 0) return false;

  const raw = (process.env.BRAIN_FIGHT_VACUUM ?? "auto").trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") {
    return false;
  }

  const force = raw === "1" || raw === "true" || raw === "on" || raw === "yes";
  const minDeleted = parsePositiveInt(
    process.env.BRAIN_FIGHT_VACUUM_MIN_DELETED,
    DEFAULT_VACUUM_MIN_DELETED,
  );
  if (!force && deletedRows < minDeleted) {
    return false;
  }

  const db = getDb();
  // VACUUM cannot run inside a transaction.
  db.exec("VACUUM");
  return true;
}

export interface StorageMaintenanceResult {
  openAbandoned: number;
  activeConflictsDeleted: number;
  debateTurnsDeleted: number;
  conflictsDeleted: number;
  decisionOutcomesDeleted: number;
  vacuumed: boolean;
}

/**
 * Opportunistic storage maintenance for stdio MCP (no cron):
 * 1) abandon zombie open debates
 * 2) prune abandoned + old completed active transcripts
 * 3) cap durable conflicts/outcomes per (session, domain)
 * 4) maybe VACUUM if enough rows were removed
 */
export function runStorageMaintenance(): StorageMaintenanceResult {
  const openAbandoned = abandonStaleOpenConflicts();
  const active = pruneStaleActiveConflicts();
  const durable = pruneDurableHistory();
  const deletedRows =
    openAbandoned +
    active.activeConflictsDeleted +
    active.debateTurnsDeleted +
    durable.conflictsDeleted +
    durable.decisionOutcomesDeleted;
  const vacuumed = maybeVacuum(deletedRows);

  return {
    openAbandoned,
    activeConflictsDeleted: active.activeConflictsDeleted,
    debateTurnsDeleted: active.debateTurnsDeleted,
    conflictsDeleted: durable.conflictsDeleted,
    decisionOutcomesDeleted: durable.decisionOutcomesDeleted,
    vacuumed,
  };
}
