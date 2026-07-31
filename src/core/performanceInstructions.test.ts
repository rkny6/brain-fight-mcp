import { describe, expect, it } from "vitest";
import {
  buildSummonPerformanceInstructions,
  buildTurnPerformanceInstructions,
  relationshipToneModifiers,
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
