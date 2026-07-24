import { describe, expect, it, vi, afterEach } from "vitest";
import { runConflict } from "./conflictEngine.js";
import { DEFAULT_RELATIONSHIP_STATE, type RelationshipState } from "../types/index.js";

function makeRelationship(overrides: Partial<RelationshipState> = {}): RelationshipState {
  return {
    sessionId: "test",
    ...DEFAULT_RELATIONSHIP_STATE,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("conflictEngine.runConflict", () => {
  it("matches a known topic template by keyword", () => {
    const output = runConflict({
      context: "I'm thinking about whether I should quit my job tomorrow",
      intensity: "medium",
      relationship: makeRelationship(),
    });

    expect(output.coreDisagreement).toBe(
      "Whether security or momentum matters more right now."
    );
  });

  it("falls back to the generic template when no keyword matches", () => {
    const output = runConflict({
      context: "Something totally unrelated to any known keyword, xyz123",
      intensity: "medium",
      relationship: makeRelationship(),
    });

    expect(output.coreDisagreement).toBe("Whether safety or freedom should win this round.");
  });

  it("scales absurdityLevel with the intensity input", () => {
    const low = runConflict({
      context: "buy a new laptop",
      intensity: "low",
      relationship: makeRelationship(),
    });
    const high = runConflict({
      context: "buy a new laptop",
      intensity: "high",
      relationship: makeRelationship(),
    });

    expect(low.absurdityLevel).toBe(0.3);
    expect(high.absurdityLevel).toBe(0.9);
  });

  it("makes Devil purely contrarian when devilAnnoyance is high", () => {
    const output = runConflict({
      context: "buy a new laptop",
      intensity: "medium",
      relationship: makeRelationship({ devilAnnoyance: 0.95 }),
    });

    expect(output.devil.position).toContain("Whatever Angel just said");
  });

  it("never triggers role reversal when cooperation is below threshold", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01); // would trigger if eligible

    const output = runConflict({
      context: "buy a new laptop",
      intensity: "medium",
      relationship: makeRelationship({ cooperation: 0.5 }),
    });

    expect(output.isRoleReversal).toBe(false);
  });

  it("can trigger role reversal when cooperation is high and the roll is low", () => {
    // First Math.random() call is the role-reversal roll; force it low.
    vi.spyOn(Math, "random").mockReturnValue(0.05);

    const output = runConflict({
      context: "buy a new laptop",
      intensity: "medium",
      relationship: makeRelationship({ cooperation: 0.9 }),
    });

    expect(output.isRoleReversal).toBe(true);
    // Under reversal, Angel should be arguing Devil's original position.
    expect(output.angel.position.replace(/[.\u2014].*$/, "").trim()).toContain(
      "Buy it"
    );
  });

  it("does not trigger role reversal when cooperation is high but the roll is above the chance threshold", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const output = runConflict({
      context: "buy a new laptop",
      intensity: "medium",
      relationship: makeRelationship({ cooperation: 0.9 }),
    });

    expect(output.isRoleReversal).toBe(false);
  });

  it("injects prior-round continuity into both sides' reasoning", () => {
    const prior = {
      id: "00000000-0000-4000-8000-000000000099",
      sessionId: "test",
      context: "Should I quit my job?",
      angelPosition: "Don't quit yet — line something up first.",
      devilPosition: "Quit. Today. Send the email.",
      winner: "devil" as const,
      absurdityLevel: 0.6,
      createdAt: Date.now(),
    };

    const output = runConflict({
      context: "If I'm not panicking anymore, can I leave?",
      intensity: "medium",
      relationship: makeRelationship(),
      priorConflicts: [prior],
    });

    expect(output.continuity.hasPrior).toBe(true);
    expect(output.continuity.prior?.winner).toBe("devil");
    expect(output.angel.reasoning).toContain(prior.angelPosition);
    expect(output.devil.reasoning).toContain(prior.angelPosition);
    expect(output.devil.reasoning).toContain(prior.devilPosition);
  });

  it("leaves continuity empty on the first conflict of a session", () => {
    const output = runConflict({
      context: "buy a new laptop",
      intensity: "low",
      relationship: makeRelationship(),
    });

    expect(output.continuity.hasPrior).toBe(false);
    expect(output.continuity.prior).toBeNull();
  });
});

