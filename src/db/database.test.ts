import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { closeDb, getDb } from "./database.js";
import { getOrCreateRelationship } from "./repositories/relationshipRepository.js";

describe("relationship_state domain-key migration", () => {
  let dbPath = "";

  afterEach(() => {
    closeDb();
    if (dbPath) {
      try {
        fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
    if (process.env.BRAIN_FIGHT_DB_PATH === dbPath) {
      delete process.env.BRAIN_FIGHT_DB_PATH;
    }
    dbPath = "";
  });

  it("upgrades a pre-domain relationship_state table without losing data", () => {
    // Hand-build a DB file using the OLD single-column-PK shape, as if it
    // had been created before topic-domain bucketing existed.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brain-fight-mcp-migrate-"));
    dbPath = path.join(dir, "old.sqlite3");

    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      CREATE TABLE relationship_state (
        session_id TEXT PRIMARY KEY,
        angel_respect REAL DEFAULT 0.5,
        devil_respect REAL DEFAULT 0.5,
        angel_annoyance REAL DEFAULT 0.2,
        devil_annoyance REAL DEFAULT 0.2,
        cooperation REAL DEFAULT 0.3,
        recent_winner TEXT,
        total_conflicts INTEGER DEFAULT 0
      );
    `);
    legacyDb
      .prepare(
        `INSERT INTO relationship_state (
           session_id, angel_respect, devil_respect, angel_annoyance,
           devil_annoyance, cooperation, recent_winner, total_conflicts
         ) VALUES ('pre-domain-user', 0.83, 0.41, 0.15, 0.62, 0.55, 'angel', 7)`,
      )
      .run();
    legacyDb.close();

    // Now point the real app connection at that same file — this is what
    // triggers migrateRelationshipStateToDomainKey() on next getDb().
    process.env.BRAIN_FIGHT_DB_PATH = dbPath;
    getDb();

    // The old row must have survived, landed in the 'general' bucket,
    // with every value intact — not reset to defaults.
    const migrated = getOrCreateRelationship("pre-domain-user", "general");
    expect(migrated.domain).toBe("general");
    expect(migrated.angelRespect).toBeCloseTo(0.83);
    expect(migrated.devilRespect).toBeCloseTo(0.41);
    expect(migrated.angelAnnoyance).toBeCloseTo(0.15);
    expect(migrated.devilAnnoyance).toBeCloseTo(0.62);
    expect(migrated.cooperation).toBeCloseTo(0.55);
    expect(migrated.recentWinner).toBe("angel");
    expect(migrated.totalConflicts).toBe(7);

    // A different domain for the same user must NOT inherit the migrated
    // data — it should be a brand-new default bucket.
    const careerBucket = getOrCreateRelationship("pre-domain-user", "career");
    expect(careerBucket.totalConflicts).toBe(0);
    expect(careerBucket.angelRespect).toBe(0.5);

    // The composite primary key must actually be enforced now: writing a
    // second domain for the same session must not collide/overwrite.
    const db = getDb();
    const rows = db
      .prepare("SELECT session_id, domain FROM relationship_state WHERE session_id = ?")
      .all("pre-domain-user");
    expect(rows).toHaveLength(2);
  });

  it("is a no-op when the table already has the domain column", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brain-fight-mcp-fresh-"));
    dbPath = path.join(dir, "fresh.sqlite3");
    process.env.BRAIN_FIGHT_DB_PATH = dbPath;

    // First call creates the fresh (already-domain-shaped) schema.
    getDb();
    getOrCreateRelationship("fresh-user", "money");

    // Closing and reconnecting must not wipe or duplicate anything.
    closeDb();
    getDb();
    const state = getOrCreateRelationship("fresh-user", "money");
    expect(state.totalConflicts).toBe(0);
  });
});

describe("full pre-domain database upgrade (regression: 'no such column: domain')", () => {
  let dbPath = "";

  afterEach(() => {
    closeDb();
    if (dbPath) {
      try {
        fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
    if (process.env.BRAIN_FIGHT_DB_PATH === dbPath) {
      delete process.env.BRAIN_FIGHT_DB_PATH;
    }
    dbPath = "";
  });

  it("opens a real pre-domain DB (all four tables, no domain columns) without throwing, and preserves old rows", () => {
    // This reproduces the exact shape of a DB created by a version of the
    // server that predates topic-domain bucketing: none of these tables
    // have a `domain` column, and relationship_state has the old
    // single-column primary key. getDb() must upgrade all of it in place.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brain-fight-mcp-full-legacy-"));
    dbPath = path.join(dir, "legacy.sqlite3");

    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      CREATE TABLE relationship_state (
        session_id TEXT PRIMARY KEY,
        angel_respect REAL DEFAULT 0.5,
        devil_respect REAL DEFAULT 0.5,
        angel_annoyance REAL DEFAULT 0.2,
        devil_annoyance REAL DEFAULT 0.2,
        cooperation REAL DEFAULT 0.3,
        recent_winner TEXT,
        total_conflicts INTEGER DEFAULT 0
      );

      CREATE TABLE conflicts (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        context TEXT NOT NULL,
        topic TEXT,
        angel_position TEXT NOT NULL,
        devil_position TEXT NOT NULL,
        winner TEXT,
        absurdity_level REAL DEFAULT 0.5,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE active_conflicts (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        context TEXT NOT NULL,
        topic TEXT,
        intensity TEXT NOT NULL,
        core_disagreement TEXT NOT NULL,
        angel_json TEXT NOT NULL,
        devil_json TEXT NOT NULL,
        likely_winner TEXT,
        is_role_reversal INTEGER NOT NULL DEFAULT 0,
        absurdity_level REAL NOT NULL DEFAULT 0.5,
        continuity_json TEXT NOT NULL,
        first_speaker TEXT NOT NULL,
        last_speaker TEXT,
        next_speaker TEXT NOT NULL,
        turn_index INTEGER NOT NULL DEFAULT 0,
        max_turns INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE decision_outcomes (
        id TEXT PRIMARY KEY,
        conflict_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        actual_choice TEXT NOT NULL,
        outcome_note TEXT,
        sentiment TEXT,
        recorded_at INTEGER NOT NULL,
        FOREIGN KEY (conflict_id) REFERENCES conflicts(id) ON DELETE CASCADE
      );
    `);

    legacyDb
      .prepare(
        `INSERT INTO conflicts (
           id, session_id, context, angel_position, devil_position, winner, absurdity_level, created_at
         ) VALUES ('11111111-1111-4111-8111-111111111111', 'legacy-user', 'old dilemma', 'wait', 'go', 'angel', 0.5, ?)`,
      )
      .run(Date.now() - 10 * 24 * 60 * 60 * 1000);
    legacyDb.close();

    process.env.BRAIN_FIGHT_DB_PATH = dbPath;

    // This is the exact call that crashed with "SqliteError: no such
    // column: domain" before the ordering fix.
    expect(() => getDb()).not.toThrow();

    const db = getDb();

    // Every table must now have a domain column, defaulted to 'general'.
    for (const table of ["conflicts", "active_conflicts", "decision_outcomes"]) {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
        name: string;
      }>;
      expect(columns.some((c) => c.name === "domain")).toBe(true);
    }

    // The old conflict row must have survived the upgrade, landed in 'general'.
    const conflictRow = db
      .prepare("SELECT domain, context FROM conflicts WHERE id = ?")
      .get("11111111-1111-4111-8111-111111111111") as
      | { domain: string; context: string }
      | undefined;
    expect(conflictRow?.domain).toBe("general");
    expect(conflictRow?.context).toBe("old dilemma");

    // The domain-scoped indexes must exist and be usable (this is what
    // actually crashed originally — confirm a query against them works).
    expect(() =>
      db
        .prepare(
          "SELECT * FROM conflicts WHERE session_id = ? AND domain = ? ORDER BY created_at DESC",
        )
        .all("legacy-user", "general"),
    ).not.toThrow();
  });
});
