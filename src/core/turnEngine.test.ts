import { describe, expect, it } from "vitest";
import {
  DOUBLE_TAP_CHANCE,
  inferTopicBias,
  maxTurnsForIntensity,
  oppositeSpeaker,
  pickFirstSpeaker,
  pickNextSpeaker,
  turnsRemaining,
} from "./turnEngine.js";
import {
  DEFAULT_RELATIONSHIP_STATE,
  type RelationshipState,
} from "../types/index.js";

function rel(overrides: Partial<RelationshipState> = {}): RelationshipState {
  return {
    sessionId: "t",
    ...DEFAULT_RELATIONSHIP_STATE,
    ...overrides,
  };
}

describe("turnEngine", () => {
  it("maps intensity to max turns", () => {
    expect(maxTurnsForIntensity("low")).toBe(2);
    expect(maxTurnsForIntensity("medium")).toBe(4);
    expect(maxTurnsForIntensity("high")).toBe(6);
  });

  it("opposites and remaining turns", () => {
    expect(oppositeSpeaker("angel")).toBe("devil");
    expect(oppositeSpeaker("devil")).toBe("angel");
    expect(turnsRemaining(1, 4)).toBe(3);
    expect(turnsRemaining(4, 4)).toBe(0);
    expect(turnsRemaining(5, 4)).toBe(0);
  });

  it("infers topic bias from keywords", () => {
    expect(inferTopicBias("I should apologize first")).toBe("caution");
    expect(inferTopicBias("I want to quit my job tonight")).toBe("impulse");
    expect(inferTopicBias("what color socks")).toBe("neutral");
  });

  it("respects explicit first speaker", () => {
    expect(
      pickFirstSpeaker({
        userChoice: "angel",
        relationship: rel({ devilAnnoyance: 1 }),
        priorWinner: "angel",
        topicBias: "impulse",
      }),
    ).toBe("angel");
  });

  it("prior winner loser opens next", () => {
    expect(
      pickFirstSpeaker({
        relationship: rel(),
        priorWinner: "angel",
      }),
    ).toBe("devil");
    expect(
      pickFirstSpeaker({
        relationship: rel(),
        priorWinner: "devil",
      }),
    ).toBe("angel");
  });

  it("high devil annoyance grabs the mic", () => {
    expect(
      pickFirstSpeaker({
        relationship: rel({ devilAnnoyance: 0.85 }),
        priorWinner: null,
      }),
    ).toBe("devil");
  });

  it("high angel respect + low cooperation lets angel set terms", () => {
    expect(
      pickFirstSpeaker({
        relationship: rel({ angelRespect: 0.75, cooperation: 0.2 }),
        priorWinner: null,
      }),
    ).toBe("angel");
  });

  it("topic bias then default devil", () => {
    expect(
      pickFirstSpeaker({
        relationship: rel(),
        priorWinner: null,
        topicBias: "caution",
      }),
    ).toBe("angel");
    expect(
      pickFirstSpeaker({
        relationship: rel(),
        priorWinner: null,
        topicBias: "impulse",
      }),
    ).toBe("devil");
    expect(
      pickFirstSpeaker({
        relationship: rel(),
        priorWinner: null,
        topicBias: "neutral",
      }),
    ).toBe("devil");
  });

  it("force speaker wins mid-debate", () => {
    const result = pickNextSpeaker({
      lastSpeaker: "angel",
      forceSpeaker: "angel",
      relationship: rel(),
    });
    expect(result).toEqual({ speaker: "angel", isDoubleTap: true });
  });

  it("alternates by default", () => {
    const result = pickNextSpeaker({
      lastSpeaker: "devil",
      relationship: rel(),
      random: () => 0.99,
    });
    expect(result).toEqual({ speaker: "angel", isDoubleTap: false });
  });

  it("rare double-tap when tense", () => {
    const result = pickNextSpeaker({
      lastSpeaker: "devil",
      relationship: rel({ devilAnnoyance: 0.9 }),
      random: () => DOUBLE_TAP_CHANCE - 0.001,
    });
    expect(result).toEqual({ speaker: "devil", isDoubleTap: true });
  });
});
