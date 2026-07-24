import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ALL_SCHEMA_STATEMENTS } from "./schema.js";

let dbInstance: Database.Database | null = null;

/**
 * Resolves where the SQLite file should live.
 * Honors ANGEL_DEVIL_DB_PATH for tests / overrides, otherwise stores it
 * under the user's home directory so `npx angel-devil-mcp` "just works"
 * regardless of which folder it's invoked from.
 */
function resolveDbPath(): string {
  if (process.env.ANGEL_DEVIL_DB_PATH) {
    return process.env.ANGEL_DEVIL_DB_PATH;
  }
  const dir = path.join(os.homedir(), ".angel-devil-mcp");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, "state.sqlite3");
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
