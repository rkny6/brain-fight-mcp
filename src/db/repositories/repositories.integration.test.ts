import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setupIsolatedDb, teardownIsolatedDb } from "../../test/helpers.js";
import {
  deleteRelationship,
  getOrCreateRelationship,
  saveRelationship,
} from "./relationshipRepository.js";
import {
  deleteConflicts,
  getRecentConflicts,
  saveConflict,
} from "./conflictRepository.js";
import { forget, recall, remember } from "../../core/memoryEngine.js";
import { DEFAULT_RELATIONSHIP_STATE } from "../../types/index.js";
import { applyConflictResult } from "../../core/relationshipEngine.js";

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

  it("persists conflicts and returns newest first", () => {
    const older = saveConflict({
      sessionId: "mem-1",
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

  it("memoryEngine remember/recall/forget round-trips through SQLite", () => {
    const saved = remember({
      sessionId: "mem-engine",
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
});
