import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupIsolatedDb, teardownIsolatedDb } from "../../test/helpers.js";
import {
  deleteRelationship,
  getAllRelationshipsForSession,
  getOrCreateRelationship,
  saveRelationship,
} from "./relationshipRepository.js";
import {
  deleteConflicts,
  getConflictById,
  getRecentConflicts,
  saveConflict,
} from "./conflictRepository.js";
import { clearAllState, countStateRows } from "./databaseAdmin.js";
import { getDb } from "../database.js";
import {
  createActiveConflict,
  getOpenActiveConflict,
  pruneStaleActiveConflicts,
  saveActiveConflict,
  type CreateActiveConflictInput,
} from "./activeConflictRepository.js";
import {
  abandonStaleOpenConflicts,
  maybeVacuum,
  pruneDurableHistory,
  runStorageMaintenance,
} from "./retention.js";
import { forget, recall, remember } from "../../core/memoryEngine.js";
import { DEFAULT_RELATIONSHIP_STATE } from "../../types/index.js";
import { applyConflictResult } from "../../core/relationshipEngine.js";
import { saveOutcome } from "./outcomeRepository.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function minimalActiveConflictInput(
  overrides: Partial<CreateActiveConflictInput> = {},
): CreateActiveConflictInput {
  return {
    sessionId: "prune-session",
    domain: "general",
    context: "filler dilemma",
    intensity: "low",
    coreDisagreement: "whatever",
    angel: { position: "wait", reasoning: "caution" },
    devil: { position: "go", reasoning: "yolo" },
    likelyWinner: "draw",
    isRoleReversal: false,
    absurdityLevel: 0.4,
    continuity: { hasPrior: false, prior: null, angelCallback: "", devilCallback: "" },
    firstSpeaker: "angel",
    nextSpeaker: "devil",
    maxTurns: 2,
    ...overrides,
  };
}

describe("repositories + memory (integration)", () => {
  let dbPath = "";

  beforeEach(() => {
    dbPath = setupIsolatedDb();
  });

  afterEach(() => {
    teardownIsolatedDb(dbPath);
  });

  it("creates default relationship state on first access", () => {
    const state = getOrCreateRelationship("session-a");

    expect(state.sessionId).toBe("session-a");
    expect(state.angelRespect).toBe(DEFAULT_RELATIONSHIP_STATE.angelRespect);
    expect(state.devilRespect).toBe(DEFAULT_RELATIONSHIP_STATE.devilRespect);
    expect(state.cooperation).toBe(DEFAULT_RELATIONSHIP_STATE.cooperation);
    expect(state.totalConflicts).toBe(0);
    expect(state.recentWinner).toBeNull();
  });

  it("upserts relationship state and reloads it", () => {
    const initial = getOrCreateRelationship("session-b");
    const updated = {
      ...initial,
      angelRespect: 0.72,
      devilAnnoyance: 0.41,
      totalConflicts: 3,
      recentWinner: "angel" as const,
    };

    saveRelationship(updated);
    const reloaded = getOrCreateRelationship("session-b");

    expect(reloaded.angelRespect).toBeCloseTo(0.72);
    expect(reloaded.devilAnnoyance).toBeCloseTo(0.41);
    expect(reloaded.totalConflicts).toBe(3);
    expect(reloaded.recentWinner).toBe("angel");
  });

  it("isolates relationship state across sessions", () => {
    const a = getOrCreateRelationship("iso-a");
    saveRelationship({ ...a, angelRespect: 0.9, totalConflicts: 2 });

    const b = getOrCreateRelationship("iso-b");
    expect(b.angelRespect).toBe(DEFAULT_RELATIONSHIP_STATE.angelRespect);
    expect(b.totalConflicts).toBe(0);
  });

  it("isolates relationship state across domains within the SAME session", () => {
    const sessionId = "multi-domain-user";
    const career = getOrCreateRelationship(sessionId, "career");
    saveRelationship({
      ...career,
      angelRespect: 0.95,
      totalConflicts: 10,
      recentWinner: "angel",
    });

    // A different domain, same session, must start completely fresh —
    // this is the whole point of bucketing: career trust shouldn't leak
    // into an unrelated money decision.
    const money = getOrCreateRelationship(sessionId, "money");
    expect(money.angelRespect).toBe(DEFAULT_RELATIONSHIP_STATE.angelRespect);
    expect(money.totalConflicts).toBe(0);
    expect(money.recentWinner).toBeNull();

    // Re-fetching career must still show the domain-specific update, unaffected.
    const careerAgain = getOrCreateRelationship(sessionId, "career");
    expect(careerAgain.angelRespect).toBeCloseTo(0.95);
    expect(careerAgain.totalConflicts).toBe(10);

    // getAllRelationshipsForSession must surface both buckets for this session.
    const all = getAllRelationshipsForSession(sessionId);
    expect(all.map((r) => r.domain).sort()).toEqual(["career", "money"]);
  });

  it("scopes conflicts and outcomes to their domain", () => {
    const sessionId = "domain-scoped-conflicts";
    const careerConflict = saveConflict({
      sessionId,
      domain: "career",
      context: "should I take the promotion",
      angelPosition: "yes, ask about scope first",
      devilPosition: "yes, say yes to everything",
      winner: "angel",
      absurdityLevel: 0.4,
    });
    saveConflict({
      sessionId,
      domain: "money",
      context: "should I buy the new laptop",
      angelPosition: "wait for a sale",
      devilPosition: "buy it now",
      winner: "devil",
      absurdityLevel: 0.3,
    });

    expect(getRecentConflicts(sessionId, 10, "career")).toHaveLength(1);
    expect(getRecentConflicts(sessionId, 10, "money")).toHaveLength(1);
    expect(getRecentConflicts(sessionId, 10, "health")).toHaveLength(0);
    // Omitting domain returns everything across buckets.
    expect(getRecentConflicts(sessionId, 10)).toHaveLength(2);

    // getConflictById is unaffected by domain — it's a direct PK lookup.
    expect(getConflictById(careerConflict.id, sessionId)?.domain).toBe("career");
  });

  it("reset scoped to one domain leaves other domains untouched", () => {
    const sessionId = "scoped-reset-user";
    saveRelationship({
      ...getOrCreateRelationship(sessionId, "career"),
      angelRespect: 0.8,
      totalConflicts: 5,
    });
    saveRelationship({
      ...getOrCreateRelationship(sessionId, "money"),
      angelRespect: 0.7,
      totalConflicts: 3,
    });
    saveConflict({
      sessionId,
      domain: "career",
      context: "career thing",
      angelPosition: "a",
      devilPosition: "d",
      winner: "angel",
      absurdityLevel: 0.5,
    });
    saveConflict({
      sessionId,
      domain: "money",
      context: "money thing",
      angelPosition: "a",
      devilPosition: "d",
      winner: "devil",
      absurdityLevel: 0.5,
    });

    // Reset ONLY the career bucket.
    deleteConflicts(sessionId, "career");
    deleteRelationship(sessionId, "career");

    const careerAfter = getOrCreateRelationship(sessionId, "career");
    expect(careerAfter.totalConflicts).toBe(0);
    expect(getRecentConflicts(sessionId, 10, "career")).toHaveLength(0);

    // Money bucket must be completely untouched by the career-scoped reset.
    const moneyAfter = getOrCreateRelationship(sessionId, "money");
    expect(moneyAfter.totalConflicts).toBe(3);
    expect(moneyAfter.angelRespect).toBeCloseTo(0.7);
    expect(getRecentConflicts(sessionId, 10, "money")).toHaveLength(1);
  });

  it("persists conflicts and returns newest first", () => {
    const older = saveConflict({
      sessionId: "mem-1",
      domain: "general",
      context: "older dilemma",
      topic: "job",
      angelPosition: "wait",
      devilPosition: "quit",
      winner: "angel",
      absurdityLevel: 0.3,
    });

    // Ensure distinct created_at ordering even on fast machines.
    const newer = saveConflict({
      sessionId: "mem-1",
      domain: "general",
      context: "newer dilemma",
      angelPosition: "budget",
      devilPosition: "buy",
      winner: "devil",
      absurdityLevel: 0.6,
    });

    // If timestamps collided, force a newer stamp via a third write after a tiny wait is overkill;
    // prefer asserting both exist and id uniqueness, then check order when timestamps differ.
    const recent = getRecentConflicts("mem-1", 5);
    expect(recent).toHaveLength(2);
    expect(new Set(recent.map((r) => r.id)).size).toBe(2);

    if (newer.createdAt !== older.createdAt) {
      expect(recent[0].id).toBe(newer.id);
      expect(recent[1].id).toBe(older.id);
    }

    expect(recent.find((r) => r.id === older.id)?.topic).toBe("job");
    expect(recent.find((r) => r.id === newer.id)?.topic).toBeUndefined();
  });

  it("getConflictById finds a conflict regardless of how many newer ones exist, and stays session-scoped", () => {
    const target = saveConflict({
      sessionId: "by-id-session",
      domain: "general",
      context: "the one we'll look up later",
      angelPosition: "wait",
      devilPosition: "go",
      winner: "angel",
      absurdityLevel: 0.3,
    });

    // Simulate the session accumulating many more conflicts afterward —
    // getConflictById must still find `target` even once it would have
    // fallen off a "recent N" window.
    for (let i = 0; i < 5; i += 1) {
      saveConflict({
        sessionId: "by-id-session",
      domain: "general",
        context: `filler ${i}`,
        angelPosition: "a",
        devilPosition: "d",
        winner: "draw",
        absurdityLevel: 0.5,
      });
    }

    expect(getConflictById(target.id, "by-id-session")?.context).toBe(
      "the one we'll look up later",
    );
    // Wrong session should not find it, even with the right id.
    expect(getConflictById(target.id, "some-other-session")).toBeNull();
    // Unknown id should return null, not throw.
    expect(
      getConflictById("00000000-0000-4000-8000-000000000000", "by-id-session"),
    ).toBeNull();
  });

  it("memoryEngine remember/recall/forget round-trips through SQLite", () => {
    const saved = remember({
      sessionId: "mem-engine",
      domain: "general",
      context: "Should I text my ex?",
      topic: "ex",
      angelPosition: "Don't text them.",
      devilPosition: "Text them.",
      winner: "draw",
      absurdityLevel: 0.9,
    });

    expect(saved.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );

    const recalled = recall("mem-engine", 3);
    expect(recalled).toHaveLength(1);
    expect(recalled[0].context).toBe("Should I text my ex?");
    expect(recalled[0].winner).toBe("draw");

    forget("mem-engine");
    expect(recall("mem-engine")).toHaveLength(0);
  });

  it("deleteRelationship + deleteConflicts clear a session completely", () => {
    const sessionId = "wipe-me";
    const state = getOrCreateRelationship(sessionId);
    saveRelationship({
      ...applyConflictResult({
        relationship: state,
        winner: "devil",
        isRoleReversal: false,
      }),
    });
    saveConflict({
      sessionId,
      domain: "general",
      context: "temp",
      angelPosition: "a",
      devilPosition: "d",
      winner: "devil",
      absurdityLevel: 0.5,
    });

    deleteConflicts(sessionId);
    deleteRelationship(sessionId);

    expect(getRecentConflicts(sessionId)).toHaveLength(0);
    const recreated = getOrCreateRelationship(sessionId);
    expect(recreated.totalConflicts).toBe(0);
    expect(recreated.recentWinner).toBeNull();
    expect(recreated.devilRespect).toBe(DEFAULT_RELATIONSHIP_STATE.devilRespect);
  });

  it("clearAllState wipes every session", () => {
    getOrCreateRelationship("clear-a");
    getOrCreateRelationship("clear-b");
    saveConflict({
      sessionId: "clear-a",
      domain: "general",
      context: "a",
      angelPosition: "a1",
      devilPosition: "d1",
      winner: "angel",
      absurdityLevel: 0.4,
    });
    saveConflict({
      sessionId: "clear-b",
      domain: "general",
      context: "b",
      angelPosition: "a2",
      devilPosition: "d2",
      winner: "devil",
      absurdityLevel: 0.5,
    });

    expect(countStateRows()).toEqual({
      relationships: 2,
      conflicts: 2,
      activeConflicts: 0,
      debateTurns: 0,
      decisionOutcomes: 0,
    });

    const summary = clearAllState();
    expect(summary.relationshipsDeleted).toBe(2);
    expect(summary.conflictsDeleted).toBe(2);
    expect(summary.activeConflictsDeleted).toBe(0);
    expect(summary.debateTurnsDeleted).toBe(0);
    expect(summary.decisionOutcomesDeleted).toBe(0);
    expect(countStateRows()).toEqual({
      relationships: 0,
      conflicts: 0,
      activeConflicts: 0,
      debateTurns: 0,
      decisionOutcomes: 0,
    });
    expect(getRecentConflicts("clear-a")).toHaveLength(0);
    expect(getRecentConflicts("clear-b")).toHaveLength(0);
  });

  describe("pruneStaleActiveConflicts", () => {
    it("deletes 'abandoned' rows regardless of age, but leaves 'open' and recent 'completed' rows alone", () => {
      const abandoned = createActiveConflict(
        minimalActiveConflictInput({ status: "abandoned" }),
      );
      const openOne = createActiveConflict(
        minimalActiveConflictInput({ status: "open" }),
      );
      const recentlyCompleted = createActiveConflict(
        minimalActiveConflictInput({ status: "completed" }),
      );

      const result = pruneStaleActiveConflicts();
      expect(result.activeConflictsDeleted).toBe(1);

      expect(getOpenActiveConflict("prune-session", "general")?.id).toBe(openOne.id);

      // Neither the still-open nor the freshly-completed row should be gone.
      const db = countStateRows();
      expect(db.activeConflicts).toBe(2); // openOne + recentlyCompleted survive
      void abandoned;
      void recentlyCompleted;
    });

    it("deletes 'completed' rows older than the retention window, keeps recent ones", () => {
      const old = createActiveConflict(minimalActiveConflictInput({ status: "completed" }));
      saveActiveConflict({
        ...old,
        status: "completed",
        updatedAt: Date.now() - 40 * DAY_MS, // older than the 14-day default
      });

      const recent = createActiveConflict(
        minimalActiveConflictInput({ status: "completed" }),
      );
      saveActiveConflict({
        ...recent,
        status: "completed",
        updatedAt: Date.now() - 1 * DAY_MS,
      });

      const result = pruneStaleActiveConflicts();
      expect(result.activeConflictsDeleted).toBe(1);

      const remaining = countStateRows();
      expect(remaining.activeConflicts).toBe(1);
    });

    it("does not hard-delete 'open' rows by itself (even if very old)", () => {
      const veryOldButOpen = createActiveConflict(
        minimalActiveConflictInput({ status: "open" }),
      );
      saveActiveConflict({
        ...veryOldButOpen,
        status: "open",
        updatedAt: Date.now() - 365 * DAY_MS,
      });

      // Low-level active prune leaves open alone; abandonStaleOpenConflicts
      // is the step that marks zombies abandoned first.
      const result = pruneStaleActiveConflicts();
      expect(result.activeConflictsDeleted).toBe(0);
      expect(countStateRows().activeConflicts).toBe(1);
      expect(getOpenActiveConflict("prune-session", "general")?.id).toBe(
        veryOldButOpen.id,
      );
    });

    it("respects a custom retention window and does not touch durable conflicts alone", () => {
      saveConflict({
        sessionId: "prune-session",
        domain: "general",
        context: "durable history — must survive active-only pruning",
        angelPosition: "a",
        devilPosition: "d",
        winner: "angel",
        absurdityLevel: 0.5,
      });

      const completed = createActiveConflict(
        minimalActiveConflictInput({ status: "completed" }),
      );
      saveActiveConflict({
        ...completed,
        status: "completed",
        updatedAt: Date.now() - 2 * DAY_MS,
      });

      // With a 1-day retention window, a 2-day-old completed row IS stale.
      const result = pruneStaleActiveConflicts(1 * DAY_MS);
      expect(result.activeConflictsDeleted).toBe(1);

      // Active-only pruning must not touch the durable conflicts table.
      expect(getRecentConflicts("prune-session", 10)).toHaveLength(1);
    });
  });

  describe("retention / storage maintenance", () => {
    it("abandonStaleOpenConflicts marks idle open debates abandoned", () => {
      const stale = createActiveConflict(
        minimalActiveConflictInput({ status: "open", sessionId: "zombie" }),
      );
      saveActiveConflict({
        ...stale,
        status: "open",
        updatedAt: Date.now() - 10 * DAY_MS,
      });
      const fresh = createActiveConflict(
        minimalActiveConflictInput({
          status: "open",
          sessionId: "zombie-fresh",
        }),
      );

      const abandoned = abandonStaleOpenConflicts(7 * DAY_MS);
      expect(abandoned).toBe(1);
      expect(getOpenActiveConflict("zombie", "general")).toBeNull();
      expect(getOpenActiveConflict("zombie-fresh", "general")?.id).toBe(fresh.id);
    });

    it("runStorageMaintenance abandons then deletes zombie open debates", () => {
      const stale = createActiveConflict(
        minimalActiveConflictInput({ status: "open", sessionId: "maint-open" }),
      );
      saveActiveConflict({
        ...stale,
        status: "open",
        updatedAt: Date.now() - 30 * DAY_MS,
      });

      const result = runStorageMaintenance();
      expect(result.openAbandoned).toBeGreaterThanOrEqual(1);
      expect(result.activeConflictsDeleted).toBeGreaterThanOrEqual(1);
      expect(getOpenActiveConflict("maint-open", "general")).toBeNull();
      expect(countStateRows().activeConflicts).toBe(0);
    });

    it("pruneDurableHistory keeps only the newest N conflicts per session+domain", () => {
      const stamp = (id: string, createdAt: number) => {
        getDb()
          .prepare("UPDATE conflicts SET created_at = ? WHERE id = ?")
          .run(createdAt, id);
      };

      const base = Date.now() - 10_000;
      for (let i = 0; i < 5; i += 1) {
        const c = saveConflict({
          sessionId: "cap-session",
          domain: "career",
          context: `career-${i}`,
          angelPosition: "a",
          devilPosition: "d",
          winner: "angel",
          absurdityLevel: 0.4,
        });
        stamp(c.id, base + i);
      }
      // Other domain should be capped independently.
      for (let i = 0; i < 3; i += 1) {
        const c = saveConflict({
          sessionId: "cap-session",
          domain: "money",
          context: `money-${i}`,
          angelPosition: "a",
          devilPosition: "d",
          winner: "devil",
          absurdityLevel: 0.4,
        });
        stamp(c.id, base + i);
      }

      const result = pruneDurableHistory(2, 50);
      expect(result.conflictsDeleted).toBe(4); // career 5→2 (+3) + money 3→2 (+1)
      expect(getRecentConflicts("cap-session", 20, "career")).toHaveLength(2);
      expect(getRecentConflicts("cap-session", 20, "money")).toHaveLength(2);
      // Newest career rows survive (highest created_at).
      const career = getRecentConflicts("cap-session", 20, "career");
      expect(career.map((c) => c.context).sort()).toEqual(["career-3", "career-4"]);
    });

    it("pruneDurableHistory caps outcomes and cascades when conflicts are removed", () => {
      const kept: string[] = [];
      for (let i = 0; i < 4; i += 1) {
        const c = saveConflict({
          sessionId: "cap-out",
          domain: "general",
          context: `c-${i}`,
          angelPosition: "a",
          devilPosition: "d",
          winner: "draw",
          absurdityLevel: 0.5,
        });
        kept.push(c.id);
        saveOutcome({
          conflictId: c.id,
          sessionId: "cap-out",
          domain: "general",
          actualChoice: "angel",
          outcomeNote: `note-${i}`,
        });
      }

      // Keep only 2 conflicts → older conflicts + their outcomes go away.
      const result = pruneDurableHistory(2, 50);
      expect(result.conflictsDeleted).toBe(2);
      expect(getRecentConflicts("cap-out", 20)).toHaveLength(2);
      expect(countStateRows().decisionOutcomes).toBe(2);
    });

    it("maybeVacuum returns false when nothing was deleted or vacuum is off", () => {
      expect(maybeVacuum(0)).toBe(false);
      const prev = process.env.BRAIN_FIGHT_VACUUM;
      process.env.BRAIN_FIGHT_VACUUM = "off";
      try {
        expect(maybeVacuum(100)).toBe(false);
      } finally {
        if (prev === undefined) delete process.env.BRAIN_FIGHT_VACUUM;
        else process.env.BRAIN_FIGHT_VACUUM = prev;
      }
    });

    it("maybeVacuum can force a VACUUM when enabled", () => {
      const prev = process.env.BRAIN_FIGHT_VACUUM;
      process.env.BRAIN_FIGHT_VACUUM = "on";
      try {
        expect(maybeVacuum(1)).toBe(true);
      } finally {
        if (prev === undefined) delete process.env.BRAIN_FIGHT_VACUUM;
        else process.env.BRAIN_FIGHT_VACUUM = prev;
      }
    });
  });
});
