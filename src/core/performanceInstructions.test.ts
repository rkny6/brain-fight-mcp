import { describe, expect, it } from "vitest";
import {
  buildEndConflictPerformanceInstructions,
  buildSummonPerformanceInstructions,
  buildTurnPerformanceInstructions,
  relationshipToneModifiers,
  type MemorableOutcome,
  type TrackRecordSummary,
} from "./performanceInstructions.js";
import type { ActiveConflict } from "../types/index.js";
import { DEFAULT_RELATIONSHIP_STATE, type RelationshipState } from "../types/index.js";

function makeRelationship(
  overrides: Partial<RelationshipState> = {},
): RelationshipState {
  return {
    sessionId: "test",
    ...DEFAULT_RELATIONSHIP_STATE,
    ...overrides,
  };
}

function makeTrackRecord(
  overrides: Partial<TrackRecordSummary> = {},
): TrackRecordSummary {
  return {
    totalRecorded: 0,
    angelChoiceCount: 0,
    devilChoiceCount: 0,
    angelChoiceGoodCount: 0,
    angelChoiceRegretCount: 0,
    devilChoiceGoodCount: 0,
    devilChoiceRegretCount: 0,
    angelWeightedGood: 0,
    angelWeightedRegret: 0,
    devilWeightedGood: 0,
    devilWeightedRegret: 0,
    ...overrides,
  };
}

function makeMemorableOutcome(
  overrides: Partial<MemorableOutcome> = {},
): MemorableOutcome {
  return {
    note: "filler note",
    recordedAt: Date.now(),
    ageDays: 0,
    ...overrides,
  };
}

function makeTurnConflict(
  overrides: Partial<ActiveConflict> = {},
): ActiveConflict {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    sessionId: "test",
    status: "open",
    context: "Ship Friday without the load test for the checkout API?",
    topic: "release",
    intensity: "medium",
    coreDisagreement: "Ship now vs wait for load test",
    angel: {
      position: "Hold the release",
      reasoning: "Weekend on-call",
      concern: "Prod melt",
    },
    devil: {
      position: "Ship Friday",
      reasoning: "Marketing window",
      temptation: "Be first",
    },
    likelyWinner: "draw",
    isRoleReversal: false,
    absurdityLevel: 0.6,
    continuity: {
      hasPrior: false,
      prior: null,
      angelCallback: "",
      devilCallback: "",
    },
    brief: {
      tension: "Ship now vs wait for load test",
      angelMust: "Hold the release",
      devilMust: "Ship Friday",
      userDetails: ["checkout API", "load test"],
      forbidden: [],
      source: "constraint_seed",
    },
    firstSpeaker: "devil",
    turnIndex: 1,
    maxTurns: 4,
    lastSpeaker: null,
    nextSpeaker: "devil",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("buildTurnPerformanceInstructions", () => {
  it("forces grounding and anti-recite rules for the single speaker", () => {
    const text = buildTurnPerformanceInstructions({
      conflict: makeTurnConflict(),
      speaker: "devil",
      turnIndex: 1,
      maxTurns: 4,
      isDoubleTap: false,
      relationship: makeRelationship(),
    });

    expect(text).toMatch(/ONLY SPEAKER/i);
    expect(text).toMatch(/GROUNDING/i);
    expect(text).toMatch(/ANTI-RECITE/i);
    expect(text).toContain("checkout API");
    expect(text).toMatch(/CONSTRAINT AXES/i);
    expect(text).toContain("devil_must argue");
    expect(text).toMatch(/do not recite|never copy|NOT dialogue/i);
    expect(text).toMatch(/VOICE CARD/i);
    expect(text).toMatch(/CADENCE:/);
    expect(text).toMatch(/SIGNATURE MOVES:/);
    expect(text).toMatch(/RELATIONSHIP TONE for this speaker/i);
    expect(text).toMatch(/Devil TONE:/i);
    expect(text).not.toMatch(/Angel TONE:/i);
  });

  it("includes track record ammo with a restraint guardrail when outcomes exist", () => {
    const text = buildTurnPerformanceInstructions({
      conflict: makeTurnConflict(),
      speaker: "devil",
      turnIndex: 3,
      maxTurns: 4,
      isDoubleTap: false,
      relationship: makeRelationship(),
      trackRecord: makeTrackRecord({
        totalRecorded: 5,
        angelChoiceCount: 2,
        devilChoiceCount: 3,
        angelChoiceGoodCount: 1,
        angelChoiceRegretCount: 1,
        devilChoiceGoodCount: 2,
        devilChoiceRegretCount: 1,
      }),
    });

    expect(text).toMatch(/REAL TRACK RECORD/i);
    expect(text).toContain("Devil went 2-1");
    expect(text).toMatch(/ONLY if it lands naturally/i);
    expect(text).toMatch(/most turns should NOT mention it/i);
    expect(text).toMatch(/Never read the raw numbers aloud/i);
  });

  it("surfaces a specific memorable outcome for the current speaker's side, with a no-verbatim guardrail", () => {
    const text = buildTurnPerformanceInstructions({
      conflict: makeTurnConflict(),
      speaker: "devil",
      turnIndex: 3,
      maxTurns: 4,
      isDoubleTap: false,
      relationship: makeRelationship(),
      trackRecord: makeTrackRecord({
        totalRecorded: 5,
        angelChoiceCount: 2,
        devilChoiceCount: 3,
        angelChoiceGoodCount: 1,
        angelChoiceRegretCount: 1,
        devilChoiceGoodCount: 2,
        devilChoiceRegretCount: 1,
        devilMemorableOutcome: makeMemorableOutcome({
          note: "Bought the laptop on impulse, returned it a week later.",
          sentiment: "regret",
          ageDays: 10,
        }),
        angelMemorableOutcome: makeMemorableOutcome({
          note: "Waited a month and it worked out fine.",
          sentiment: "good",
          ageDays: 10,
        }),
      }),
    });

    expect(text).toMatch(/SPECIFIC MEMORY/i);
    expect(text).toContain("Bought the laptop on impulse, returned it a week later.");
    expect(text).toContain("(outcome: regret)");
    // Angel's memorable outcome should NOT leak into Devil's turn instructions.
    expect(text).not.toContain("Waited a month and it worked out fine.");
    expect(text).toMatch(/do not quote it verbatim/i);
    expect(text).toMatch(/INSTEAD of the raw counts/i);
  });

  it("phrases an old memorable outcome as long-ago, not as if it just happened", () => {
    const text = buildTurnPerformanceInstructions({
      conflict: makeTurnConflict(),
      speaker: "devil",
      turnIndex: 3,
      maxTurns: 4,
      isDoubleTap: false,
      relationship: makeRelationship(),
      trackRecord: makeTrackRecord({
        totalRecorded: 1,
        devilChoiceCount: 1,
        devilChoiceRegretCount: 1,
        devilMemorableOutcome: makeMemorableOutcome({
          note: "Quit the job on a whim.",
          sentiment: "regret",
          ageDays: 200,
        }),
      }),
    });

    expect(text).toMatch(/a long time ago/i);
    expect(text).toMatch(/don't say "last time" for something months old/i);
    expect(text).toContain("200d ago");
  });

  it("phrases a very recent memorable outcome as recent/just now", () => {
    const text = buildTurnPerformanceInstructions({
      conflict: makeTurnConflict(),
      speaker: "angel",
      turnIndex: 1,
      maxTurns: 4,
      isDoubleTap: false,
      relationship: makeRelationship(),
      trackRecord: makeTrackRecord({
        totalRecorded: 1,
        angelChoiceCount: 1,
        angelChoiceGoodCount: 1,
        angelMemorableOutcome: makeMemorableOutcome({
          note: "Waited it out, worked out great.",
          sentiment: "good",
          ageDays: 1,
        }),
      }),
    });

    expect(text).toMatch(/just now \/ very recently/i);
    expect(text).not.toMatch(/a long time ago/i);
  });

  it("surfaces recency-weighted counts alongside all-time counts, and tells the model to prefer the weighted read", () => {
    const text = buildTurnPerformanceInstructions({
      conflict: makeTurnConflict(),
      speaker: "devil",
      turnIndex: 1,
      maxTurns: 4,
      isDoubleTap: false,
      relationship: makeRelationship(),
      trackRecord: makeTrackRecord({
        totalRecorded: 3,
        devilChoiceCount: 3,
        devilChoiceGoodCount: 1,
        devilChoiceRegretCount: 2,
        devilWeightedGood: 0.9,
        devilWeightedRegret: 0.15,
      }),
    });

    expect(text).toContain("Devil went 1-2 (good-regret) all-time");
    expect(text).toContain("that's 0.9-0.15");
    expect(text).toMatch(/prefer this weighted read over the all-time one/i);
  });

  it("omits SPECIFIC MEMORY when no memorable outcome exists for either side", () => {
    const text = buildTurnPerformanceInstructions({
      conflict: makeTurnConflict(),
      speaker: "devil",
      turnIndex: 3,
      maxTurns: 4,
      isDoubleTap: false,
      relationship: makeRelationship(),
      trackRecord: makeTrackRecord({
        totalRecorded: 2,
        angelChoiceCount: 1,
        devilChoiceCount: 1,
        angelChoiceGoodCount: 1,
        angelChoiceRegretCount: 0,
        devilChoiceGoodCount: 1,
        devilChoiceRegretCount: 0,
      }),
    });

    expect(text).toMatch(/REAL TRACK RECORD/i);
    expect(text).not.toMatch(/SPECIFIC MEMORY/i);
  });

  it("omits track record entirely when there are no recorded outcomes yet", () => {
    const textUndefined = buildTurnPerformanceInstructions({
      conflict: makeTurnConflict(),
      speaker: "angel",
      turnIndex: 1,
      maxTurns: 4,
      isDoubleTap: false,
      relationship: makeRelationship(),
    });
    expect(textUndefined).not.toMatch(/REAL TRACK RECORD/i);

    const textEmpty = buildTurnPerformanceInstructions({
      conflict: makeTurnConflict(),
      speaker: "angel",
      turnIndex: 1,
      maxTurns: 4,
      isDoubleTap: false,
      relationship: makeRelationship(),
      trackRecord: makeTrackRecord({ totalRecorded: 0 }),
    });
    expect(textEmpty).not.toMatch(/REAL TRACK RECORD/i);
  });
});

describe("relationshipToneModifiers", () => {
  it("always includes dyad tone and scopes speaker rails in turn mode", () => {
    const full = relationshipToneModifiers(
      makeRelationship({
        angelRespect: 0.8,
        devilRespect: 0.4,
        cooperation: 0.5,
      }),
    );
    expect(full.some((l) => /Angel TONE: high respect/i.test(l))).toBe(true);
    expect(full.some((l) => /Devil TONE:/i.test(l))).toBe(true);
    expect(full.some((l) => /DYAD:/i.test(l))).toBe(true);

    const devilOnly = relationshipToneModifiers(
      makeRelationship({
        angelRespect: 0.8,
        devilAnnoyance: 0.9,
        cooperation: 0.2,
      }),
      { speaker: "devil" },
    );
    expect(
      devilOnly.some((l) => /Devil HEAT: annoyance very high/i.test(l)),
    ).toBe(true);
    expect(devilOnly.some((l) => /Angel TONE:/i.test(l))).toBe(false);
    expect(
      devilOnly.some((l) =>
        /Opponent vibe: Angel is currently well-respected/i.test(l),
      ),
    ).toBe(true);
    expect(devilOnly.some((l) => /DYAD: low cooperation/i.test(l))).toBe(true);
  });
});

describe("buildSummonPerformanceInstructions", () => {
  it("asks for first-person generation with seed inspiration", () => {
    const text = buildSummonPerformanceInstructions("angel", undefined, {
      position: "Sleep on it.",
      reasoning: "Impulse fades.",
      concern: "Buyer's remorse.",
    });

    expect(text).toMatch(/GENERATE/i);
    expect(text.toLowerCase()).toContain("angel");
    expect(text).toContain("Sleep on it.");
    expect(text).toMatch(/first person/i);
    expect(text).toMatch(/VOICE CARD/i);
    expect(text).toMatch(/\bDO:/);
    expect(text).toMatch(/DON'T:/);
  });

  it("switches to Chinese voice card when user context is Chinese", () => {
    const text = buildSummonPerformanceInstructions(
      "devil",
      undefined,
      {
        position: "辞。今天就发邮件。",
        reasoning: "这份工作不会变好。",
        temptation: "收件箱清空的安静。",
      },
      { userContext: "我要不要裸辞？房租下个月到期。" },
    );

    expect(text).toMatch(/VOICE CARD ZH/);
    expect(text).toMatch(/用户用中文/);
    expect(text).toMatch(/得了吧|损友|短句|机会成本/);
  });
});

describe("Chinese performance locale", () => {
  it("injects zh voice cards into turn instructions", () => {
    const text = buildTurnPerformanceInstructions({
      conflict: makeTurnConflict({
        context: "我要不要裸辞？房租下个月到期，存款只够三个月。",
        coreDisagreement: "现在更重要的是安全感还是行动力。",
        angel: {
          position: "别急着辞，先找好下家。",
          reasoning: "有规划地离开。",
          concern: "没有缓冲会恐慌。",
        },
        devil: {
          position: "辞。今天就发邮件。",
          reasoning: "工作不会变好。",
          temptation: "清空收件箱。",
        },
      }),
      speaker: "angel",
      turnIndex: 1,
      maxTurns: 4,
      isDoubleTap: false,
      relationship: makeRelationship(),
    });

    expect(text).toMatch(/VOICE CARD ZH/);
    expect(text).toMatch(/用户用中文/);
    expect(text).toMatch(/先别急着定|软问/);
    expect(text).not.toMatch(/soft questions: 'what if/i);
  });
});

describe("buildEndConflictPerformanceInstructions", () => {
  it("includes the closing basics: winner, relationship snapshot, and one actionable step", () => {
    const text = buildEndConflictPerformanceInstructions({
      conflict: makeTurnConflict(),
      winner: "angel",
      relationship: makeRelationship({ totalConflicts: 3 }),
    });

    expect(text).toMatch(/DEBATE CLOSED/i);
    expect(text).toMatch(/Recorded winner for relationship state: angel/);
    expect(text).toMatch(/totalConflicts=3/);
    expect(text).toMatch(/ONE concrete, actionable next step/i);
    expect(text).toMatch(/record_decision_outcome/);
    expect(text).not.toMatch(/RARE MILESTONE/i);
  });

  it("includes a restrained milestone callout when milestones were passed", () => {
    const text = buildEndConflictPerformanceInstructions({
      conflict: makeTurnConflict(),
      winner: "devil",
      relationship: makeRelationship({ totalConflicts: 10 }),
      milestones: [
        {
          key: "conflicts_10",
          note: "This is the 10th completed debate in this domain.",
        },
      ],
    });

    expect(text).toMatch(/RARE MILESTONE/i);
    expect(text).toContain("10th completed debate");
    expect(text).toMatch(/genuinely surprised/i);
    expect(text).toMatch(/not.*fourth.wall|not breaking the fourth wall/i);
    expect(text).toMatch(/ONE brief, genuinely surprised in-character line/i);
  });

  it("lists every milestone note when more than one fires in the same round", () => {
    const text = buildEndConflictPerformanceInstructions({
      conflict: makeTurnConflict(),
      winner: "angel",
      relationship: makeRelationship({ totalConflicts: 10, cooperation: 0.95 }),
      milestones: [
        { key: "conflicts_10", note: "This is the 10th completed debate." },
        { key: "high_cooperation", note: "Cooperation just crossed a rare high threshold." },
      ],
    });

    expect(text).toContain("This is the 10th completed debate.");
    expect(text).toContain("Cooperation just crossed a rare high threshold.");
  });

  it("omits the milestone block entirely when milestones is an empty array", () => {
    const text = buildEndConflictPerformanceInstructions({
      conflict: makeTurnConflict(),
      winner: "draw",
      relationship: makeRelationship(),
      milestones: [],
    });

    expect(text).not.toMatch(/RARE MILESTONE/i);
  });

  it("grounds the next step in the winner's specific memory when one exists", () => {
    const text = buildEndConflictPerformanceInstructions({
      conflict: makeTurnConflict(),
      winner: "devil",
      relationship: makeRelationship(),
      trackRecord: makeTrackRecord({
        totalRecorded: 3,
        angelChoiceCount: 1,
        devilChoiceCount: 2,
        angelChoiceGoodCount: 1,
        angelChoiceRegretCount: 0,
        devilChoiceGoodCount: 1,
        devilChoiceRegretCount: 1,
        devilMemorableOutcome: makeMemorableOutcome({
          note: "Sent the risky email, got the promotion anyway.",
          sentiment: "good",
          ageDays: 5,
        }),
      }),
    });

    expect(text).toContain("Sent the risky email, got the promotion anyway.");
    expect(text).toMatch(/Paraphrase it as an actual memory/i);
  });

  it("does not reference a memorable outcome belonging to the losing side", () => {
    const text = buildEndConflictPerformanceInstructions({
      conflict: makeTurnConflict(),
      winner: "angel",
      relationship: makeRelationship(),
      trackRecord: makeTrackRecord({
        totalRecorded: 3,
        angelChoiceCount: 1,
        devilChoiceCount: 2,
        angelChoiceGoodCount: 0,
        angelChoiceRegretCount: 0,
        devilChoiceGoodCount: 1,
        devilChoiceRegretCount: 1,
        devilMemorableOutcome: makeMemorableOutcome({
          note: "Sent the risky email, got the promotion anyway.",
          sentiment: "good",
          ageDays: 5,
        }),
        // No angelMemorableOutcome — angel won, but has no specific memory yet.
      }),
    });

    expect(text).not.toContain("Sent the risky email, got the promotion anyway.");
  });
});
