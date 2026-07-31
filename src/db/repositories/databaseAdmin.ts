import { getDb } from "../database.js";

export interface ClearAllStateResult {
  relationshipsDeleted: number;
  conflictsDeleted: number;
  activeConflictsDeleted: number;
  debateTurnsDeleted: number;
  decisionOutcomesDeleted: number;
}

/**
 * Wipes every row in application state tables (all sessions).
 * Profiles are not stored in SQLite, so they are unaffected.
 */
export function clearAllState(): ClearAllStateResult {
  const db = getDb();

  const clear = db.transaction(() => {
    // Children first (FK cascade is on, but explicit is clearer for counts).
    const debateTurns = db.prepare("DELETE FROM debate_turns").run();
    const activeConflicts = db.prepare("DELETE FROM active_conflicts").run();
    const decisionOutcomes = db.prepare("DELETE FROM decision_outcomes").run();
    const conflicts = db.prepare("DELETE FROM conflicts").run();
    const relationships = db.prepare("DELETE FROM relationship_state").run();
    return {
      relationshipsDeleted: relationships.changes,
      conflictsDeleted: conflicts.changes,
      activeConflictsDeleted: activeConflicts.changes,
      debateTurnsDeleted: debateTurns.changes,
      decisionOutcomesDeleted: decisionOutcomes.changes,
    };
  });

  return clear();
}

/** Lightweight counts for admin/debug responses. */
export function countStateRows(): {
  relationships: number;
  conflicts: number;
  activeConflicts: number;
  debateTurns: number;
  decisionOutcomes: number;
} {
  const db = getDb();
  const relationships = db
    .prepare("SELECT COUNT(*) AS n FROM relationship_state")
    .get() as { n: number };
  const conflicts = db
    .prepare("SELECT COUNT(*) AS n FROM conflicts")
    .get() as { n: number };
  const activeConflicts = db
    .prepare("SELECT COUNT(*) AS n FROM active_conflicts")
    .get() as { n: number };
  const debateTurns = db
    .prepare("SELECT COUNT(*) AS n FROM debate_turns")
    .get() as { n: number };
  const decisionOutcomes = db
    .prepare("SELECT COUNT(*) AS n FROM decision_outcomes")
    .get() as { n: number };
  return {
    relationships: relationships.n,
    conflicts: conflicts.n,
    activeConflicts: activeConflicts.n,
    debateTurns: debateTurns.n,
    decisionOutcomes: decisionOutcomes.n,
  };
}
