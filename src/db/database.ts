import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ALL_SCHEMA_STATEMENTS, CREATE_RELATIONSHIP_STATE_TABLE } from "./schema.js";

let dbInstance: Database.Database | null = null;

/**
 * Resolves where the SQLite file should live.
 * Honors BRAIN_FIGHT_DB_PATH for tests / overrides, otherwise stores it
 * under the user's home directory so `npx brain-fight-mcp` "just works"
 * regardless of which folder it's invoked from.
 */
function resolveDbPath(): string {
  if (process.env.BRAIN_FIGHT_DB_PATH) {
    return process.env.BRAIN_FIGHT_DB_PATH;
  }
  const dir = path.join(os.homedir(), ".brain-fight-mcp");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, "state.sqlite3");
}

/**
 * relationship_state's primary key changed from (session_id) to
 * (session_id, domain) when topic-domain bucketing was added. ADD COLUMN
 * can't change a primary key, so DBs created before this needs an actual
 * table rebuild: rename old table, create the new-shape table, copy every
 * existing row in as domain='general' (nothing is lost, it just becomes
 * the "general" bucket), then drop the old table.
 */
function migrateRelationshipStateToDomainKey(db: Database.Database): void {
  const columns = db
    .prepare("PRAGMA table_info(relationship_state)")
    .all() as Array<{ name: string }>;
  const hasDomainColumn = columns.some((c) => c.name === "domain");
  if (columns.length === 0 || hasDomainColumn) {
    // Fresh DB (table doesn't exist yet) or already migrated — nothing to do.
    return;
  }

  const migrate = db.transaction(() => {
    db.exec("ALTER TABLE relationship_state RENAME TO relationship_state_pre_domain;");
    db.exec(CREATE_RELATIONSHIP_STATE_TABLE);
    db.exec(`
      INSERT INTO relationship_state (
        session_id, domain, angel_respect, devil_respect,
        angel_annoyance, devil_annoyance, cooperation, recent_winner, total_conflicts
      )
      SELECT session_id, 'general', angel_respect, devil_respect,
        angel_annoyance, devil_annoyance, cooperation, recent_winner, total_conflicts
      FROM relationship_state_pre_domain;
    `);
    db.exec("DROP TABLE relationship_state_pre_domain;");
  });
  migrate();
}

/** Returns the shared, lazily-initialized SQLite connection (singleton). */
export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = resolveDbPath();
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  migrateRelationshipStateToDomainKey(db);

  // Soft-migrate columns added after first release. These MUST run before
  // ALL_SCHEMA_STATEMENTS below: some of those statements create indexes
  // on `domain` (e.g. idx_conflicts_session_domain), and CREATE INDEX
  // fails immediately if the column doesn't exist yet on an old table —
  // CREATE TABLE IF NOT EXISTS is a silent no-op there, so the column
  // has to be added here first. On a brand-new DB the table doesn't
  // exist yet either, so these ALTERs harmlessly fail into the catch,
  // and the subsequent CREATE TABLE statements bring in `domain` inline.
  const softMigrations = [
    "ALTER TABLE active_conflicts ADD COLUMN brief_json TEXT",
    "ALTER TABLE active_conflicts ADD COLUMN domain TEXT NOT NULL DEFAULT 'general'",
    "ALTER TABLE conflicts ADD COLUMN domain TEXT NOT NULL DEFAULT 'general'",
    "ALTER TABLE decision_outcomes ADD COLUMN domain TEXT NOT NULL DEFAULT 'general'",
  ];
  for (const statement of softMigrations) {
    try {
      db.exec(statement);
    } catch {
      // column already present, or table doesn't exist yet (fresh DB)
    }
  }

  for (const statement of ALL_SCHEMA_STATEMENTS) {
    db.exec(statement);
  }

  dbInstance = db;
  return dbInstance;
}

/** Closes the connection. Mainly useful for tests. */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
