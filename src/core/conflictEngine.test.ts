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
    expect(output.brief?.userDetails).toContain("tomorrow");
    // Prefer multi-word anchors that already contain the life noun.
    expect(output.brief?.userDetails.join(" ")).toMatch(/job/i);
  });

  it("falls back to the generic template when no keyword matches", () => {
    const output = runConflict({
      context: "Something totally unrelated to any known keyword, xyz123",
      intensity: "medium",
      relationship: makeRelationship(),
    });

    expect(output.coreDisagreement).toBe(
      "Whether safety or freedom should win this round.",
    );
    // Even on generic, extract concrete scraps from context for grounding.
    expect(output.brief?.userDetails.length).toBeGreaterThan(0);
    expect(output.brief?.userDetails.join(" ")).toMatch(/xyz123|unrelated|keyword/i);
    expect(output.brief?.forbidden).toContain(
      "generic safety vs freedom slogan as the whole argument",
    );
  });

  it("extracts money/time anchors into brief.userDetails without a seed", () => {
    const output = runConflict({
      context:
        "Should I buy the $1200 laptop tonight even though rent is due next month?",
      intensity: "medium",
      relationship: makeRelationship(),
    });

    expect(output.coreDisagreement).toMatch(/restraint or reward|safety or freedom/i);
    expect(output.brief?.source).toBe("template");
    expect(output.brief?.userDetails.some((d) => /\$?\s?1200|1200/.test(d))).toBe(
      true,
    );
    expect(output.brief?.userDetails.some((d) => /tonight|next month/i.test(d))).toBe(
      true,
    );
  });

  it("can soft-match a near-miss career pivot without exact keyword", () => {
    const output = runConflict({
      context:
        "I want to leave software and start over in a new industry after ten years",
      intensity: "medium",
      relationship: makeRelationship(),
    });

    // Prefer career-change template via keyword/overlap rather than pure generic.
    expect(output.coreDisagreement).not.toBe(
      "Whether safety or freedom should win this round.",
    );
    expect(output.brief?.userDetails.length).toBeGreaterThan(0);
  });

  it("backfills userDetails for legacy seeds from free-form context", () => {
    const output = runConflict({
      context: "Ship Friday without the load test for checkout API?",
      intensity: "medium",
      relationship: makeRelationship(),
      seed: {
        coreDisagreement: "Ship Friday vs wait for load test.",
        angelPosition: "Hold the release.",
        angelReasoning: "Weekend on-call risk.",
        angelConcern: "Prod melt.",
        devilPosition: "Ship Friday.",
        devilReasoning: "Window closes.",
        devilTemptation: "Being first.",
      },
    });

    expect(output.brief?.source).toBe("legacy_seed");
    expect(output.brief?.userDetails.length).toBeGreaterThan(0);
    expect(output.brief?.userDetails.join(" ")).toMatch(/Friday|checkout|load test/i);
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
    // Under reversal, Angel should be arguing Devil's original plain position
    // (no intensity suffixes like "Seriously." / "no half measures").
    expect(output.angel.position).toContain("Buy it");
    expect(output.angel.position).not.toMatch(/Seriously\.|no half measures/i);
  });

  it("keeps seed stances plain without dramatize/intensify decoration", () => {
    const high = runConflict({
      context: "buy a new laptop",
      intensity: "high",
      relationship: makeRelationship(),
    });

    expect(high.angel.position).not.toMatch(/Seriously\.|no half measures/i);
    expect(high.devil.position).not.toMatch(/Seriously\.|no half measures/i);
    // Old dramatizeReasoning prepended stock openers like "Let's just slow down".
    expect(high.angel.reasoning).not.toMatch(
      /Let's just slow down|I hear you, but hang on|Okay, before we do anything/i,
    );
    expect(high.absurdityLevel).toBe(0.9);
  });

  it("uses caller legacy seed positions verbatim without intensity rewrites", () => {
    const output = runConflict({
      context: "Should we ship Friday without the load test?",
      intensity: "high",
      relationship: makeRelationship(),
      seed: {
        coreDisagreement: "Ship Friday vs wait for load test.",
        angelPosition: "Hold the release until the load test is green.",
        angelReasoning: "A Friday rollback ruins the weekend on-call.",
        angelConcern: "Prod melts during peak traffic.",
        devilPosition: "Ship Friday; the window is real.",
        devilReasoning: "Marketing already teed up the announcement.",
        devilTemptation: "Being first this quarter.",
      },
    });

    expect(output.coreDisagreement).toBe("Ship Friday vs wait for load test.");
    expect(output.angel.position).toBe(
      "Hold the release until the load test is green.",
    );
    expect(output.devil.position).toBe("Ship Friday; the window is real.");
    expect(output.angel.position).not.toMatch(/Seriously\.|no half measures/i);
    expect(output.brief?.source).toBe("legacy_seed");
    expect(output.brief?.tension).toBe("Ship Friday vs wait for load test.");
  });

  it("maps constraint-axis seed to rails without monologue reasoning gold", () => {
    const output = runConflict({
      context: "Should we ship Friday without the load test for checkout API?",
      intensity: "high",
      relationship: makeRelationship(),
      seed: {
        tension: "Ship Friday vs wait for the load test.",
        angelMust: "Irreversible cost of a Friday prod melt / protect weekend on-call.",
        devilMust: "Marketing window closes; delay is fear dressed as process.",
        userDetails: ["checkout API", "Friday", "load test", "on-call"],
        forbidden: ["generic safety vs freedom slogan"],
      },
    });

    expect(output.coreDisagreement).toBe("Ship Friday vs wait for the load test.");
    expect(output.angel.position).toContain("Friday prod melt");
    expect(output.devil.position).toContain("Marketing window");
    // Constraint seeds intentionally leave reasoning empty (Client invents lines).
    expect(output.angel.reasoning).toBe("");
    expect(output.devil.reasoning).toBe("");
    expect(output.brief?.source).toBe("constraint_seed");
    expect(output.brief?.userDetails).toContain("checkout API");
    expect(output.brief?.forbidden).toContain("generic safety vs freedom slogan");
    expect(output.angel.position).not.toMatch(/Seriously\.|no half measures/i);
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

