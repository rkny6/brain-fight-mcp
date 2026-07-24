import { describe, expect, it } from "vitest";
import { applyConflictResult } from "./relationshipEngine.js";
import { DEFAULT_RELATIONSHIP_STATE, type RelationshipState } from "../types/index.js";

function makeRelationship(overrides: Partial<RelationshipState> = {}): RelationshipState {
  return {
    sessionId: "test",
    ...DEFAULT_RELATIONSHIP_STATE,
    ...overrides,
  };
}

describe("relationshipEngine.applyConflictResult", () => {
  it("boosts angelRespect and devilAnnoyance when angel wins", () => {
    const before = makeRelationship();
    const after = applyConflictResult({
      relationship: before,
      winner: "angel",
      isRoleReversal: false,
    });

    expect(after.angelRespect).toBeCloseTo(before.angelRespect + 0.02);
    expect(after.devilAnnoyance).toBeCloseTo(before.devilAnnoyance + 0.03);
    expect(after.totalConflicts).toBe(before.totalConflicts + 1);
    expect(after.recentWinner).toBe("angel");
  });

  it("boosts devilRespect and angelAnnoyance when devil wins", () => {
    const before = makeRelationship();
    const after = applyConflictResult({
      relationship: before,
      winner: "devil",
      isRoleReversal: false,
    });

    expect(after.devilRespect).toBeCloseTo(before.devilRespect + 0.02);
    expect(after.angelAnnoyance).toBeCloseTo(before.angelAnnoyance + 0.03);
  });

  it("boosts cooperation on a draw", () => {
    const before = makeRelationship();
    const after = applyConflictResult({
      relationship: before,
      winner: "draw",
      isRoleReversal: false,
    });

    expect(after.cooperation).toBeCloseTo(before.cooperation + 0.05);
  });

  it("adds a cooperation bonus on role reversal, stacking with the base rule", () => {
    const before = makeRelationship();
    const after = applyConflictResult({
      relationship: before,
      winner: "draw",
      isRoleReversal: true,
    });

    expect(after.cooperation).toBeCloseTo(before.cooperation + 0.05 + 0.02);
  });

  it("clamps values to a maximum of 1", () => {
    const before = makeRelationship({ angelRespect: 0.995, devilAnnoyance: 0.99 });
    const after = applyConflictResult({
      relationship: before,
      winner: "angel",
      isRoleReversal: false,
    });

    expect(after.angelRespect).toBeLessThanOrEqual(1);
    expect(after.devilAnnoyance).toBeLessThanOrEqual(1);
  });
});
