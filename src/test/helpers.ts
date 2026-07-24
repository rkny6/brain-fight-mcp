import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDb, getDb } from "../db/database.js";

/**
 * Isolates each integration test on its own SQLite file so concurrent
 * vitest workers and sequential cases never share state.
 */
export function setupIsolatedDb(): string {
  closeDb();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "angel-devil-mcp-"));
  const dbPath = path.join(dir, "test.sqlite3");
  process.env.ANGEL_DEVIL_DB_PATH = dbPath;
  getDb();
  return dbPath;
}

/** Closes the connection and deletes the temp DB directory. */
export function teardownIsolatedDb(dbPath: string): void {
  closeDb();
  const dir = path.dirname(dbPath);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup; OS temp will reclaim leftover files.
  }
  if (process.env.ANGEL_DEVIL_DB_PATH === dbPath) {
    delete process.env.ANGEL_DEVIL_DB_PATH;
  }
}

/** Extracts and parses the first text content block from an MCP tool result. */
export function parseToolJson<T = unknown>(result: {
  content: Array<{ type: string; text?: string }>;
}): T {
  const block = result.content.find((c) => c.type === "text" && typeof c.text === "string");
  if (!block?.text) {
    throw new Error("Tool result did not include a text content block");
  }
  return JSON.parse(block.text) as T;
}
