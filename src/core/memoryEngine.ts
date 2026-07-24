import {
  deleteConflicts,
  getRecentConflicts,
  saveConflict,
  type SaveConflictInput,
} from "../db/repositories/conflictRepository.js";
import type { ConflictRecord } from "../types/index.js";

/** Persists a finished conflict to SQLite. */
export function remember(input: SaveConflictInput): ConflictRecord {
  return saveConflict(input);
}

/** Retrieves the most recent conflicts for a session (default: last 5). */
export function recall(sessionId: string, limit = 5): ConflictRecord[] {
  return getRecentConflicts(sessionId, limit);
}

/** Wipes all conflict memory for a session. */
export function forget(sessionId: string): void {
  deleteConflicts(sessionId);
}
