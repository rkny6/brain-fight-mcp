import { describe, expect, it } from "vitest";
import { buildTrackRecord } from "./memoryEngine.js";
import type { ActualChoice, DecisionOutcome, OutcomeSentiment } from "../types/index.js";

let seq = 0;
function makeOutcome(
  actualChoice: ActualChoice,
  sentiment: OutcomeSentiment | undefined,
  outcomeNote: string | undefined,
  recordedAt: number,
): DecisionOutcome {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    conflictId: `00000000-0000-4000-9000-${String(seq).padStart(12, "0")}`,
    sessionId: "s",
    domain: "general",
    actualChoice,
    outcomeNote,
    sentiment,
    recordedAt,
  };
}

describe("buildTrackRecord — memorable outcome selection", () => {
  it("returns undefined for a side with no outcomes at all", () => {
    const record = buildTrackRecord([]);
    expect(record.angelMemorableOutcome).toBeUndefined();
    expect(record.devilMemorableOutcome).toBeUndefined();
  });

  it("returns undefined for a side that has outcomes but none with a note", () => {
    const outcomes = [
      makeOutcome("devil", "regret", undefined, 100),
      makeOutcome("devil", "good", "", 90), // empty string counts as no note
    ];
    const record = buildTrackRecord(outcomes);
    expect(record.devilMemorableOutcome).toBeUndefined();
  });

  it("picks the note text and sentiment for the matching side, ignoring the other side", () => {
    const outcomes = [
      makeOutcome("angel", "good", "I waited and it worked out.", 100),
      makeOutcome("devil", "regret", "Bought the laptop, returned it a week later.", 90),
    ];
    const record = buildTrackRecord(outcomes);
    expect(record.angelMemorableOutcome?.note).toBe("I waited and it worked out.");
    expect(record.angelMemorableOutcome?.sentiment).toBe("good");
    expect(record.devilMemorableOutcome?.note).toBe(
      "Bought the laptop, returned it a week later.",
    );
    expect(record.devilMemorableOutcome?.sentiment).toBe("regret");
  });

  it("prefers a definite good/regret sentiment over mixed/too_early, even if the vague one is more recent", () => {
    const outcomes = [
      // Newest first, as recallOutcomes/getRecentOutcomes returns.
      makeOutcome("devil", "too_early", "Still waiting to hear back.", 200),
      makeOutcome("devil", "regret", "Quit on the spot, immediately regretted it.", 100),
    ];
    const record = buildTrackRecord(outcomes);
    expect(record.devilMemorableOutcome?.note).toBe(
      "Quit on the spot, immediately regretted it.",
    );
  });

  it("falls back to the newest note-bearing outcome when none have a definite sentiment", () => {
    const outcomes = [
      makeOutcome("angel", "too_early", "Newer, still pending.", 200),
      makeOutcome("angel", "mixed", "Older, mixed bag.", 100),
    ];
    const record = buildTrackRecord(outcomes);
    expect(record.angelMemorableOutcome?.note).toBe("Newer, still pending.");
  });

  it("does not let a memorable pick affect the aggregate counts", () => {
    const outcomes = [
      makeOutcome("devil", "regret", "note here", 100),
      makeOutcome("devil", "good", undefined, 90),
    ];
    const record = buildTrackRecord(outcomes);
    expect(record.devilChoiceCount).toBe(2);
    expect(record.devilChoiceGoodCount).toBe(1);
    expect(record.devilChoiceRegretCount).toBe(1);
  });
});

describe("buildTrackRecord — recency-weighted decay", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const NOW = 1_700_000_000_000; // fixed reference point for deterministic tests

  it("weighs an outcome from right now at ~1.0", () => {
    const outcomes = [makeOutcome("devil", "regret", undefined, NOW)];
    const record = buildTrackRecord(outcomes, NOW);
    expect(record.devilWeightedRegret).toBeCloseTo(1.0, 2);
  });

  it("halves the weight at exactly one half-life (60 days) ago", () => {
    const outcomes = [makeOutcome("angel", "good", undefined, NOW - 60 * DAY_MS)];
    const record = buildTrackRecord(outcomes, NOW);
    expect(record.angelWeightedGood).toBeCloseTo(0.5, 2);
  });

  it("quarters the weight at two half-lives (120 days) ago", () => {
    const outcomes = [makeOutcome("angel", "good", undefined, NOW - 120 * DAY_MS)];
    const record = buildTrackRecord(outcomes, NOW);
    expect(record.angelWeightedGood).toBeCloseTo(0.25, 2);
  });

  it("fades a year-old outcome close to zero but never lets it hit exactly zero", () => {
    const outcomes = [makeOutcome("devil", "regret", undefined, NOW - 365 * DAY_MS)];
    const record = buildTrackRecord(outcomes, NOW);
    expect(record.devilWeightedRegret).toBeGreaterThan(0);
    expect(record.devilWeightedRegret).toBeLessThan(0.05);
  });

  it("lets a recent outcome dominate an old one of the opposite sentiment in the weighted sum", () => {
    const outcomes = [
      makeOutcome("devil", "good", undefined, NOW), // right now
      makeOutcome("devil", "regret", undefined, NOW - 365 * DAY_MS), // a year ago
    ];
    const record = buildTrackRecord(outcomes, NOW);
    // Raw counts treat them as equally important (1 good, 1 regret)...
    expect(record.devilChoiceGoodCount).toBe(1);
    expect(record.devilChoiceRegretCount).toBe(1);
    // ...but the weighted read should clearly favor "recently good."
    expect(record.devilWeightedGood).toBeGreaterThan(record.devilWeightedRegret * 10);
  });

  it("computes ageDays on the memorable outcome consistently with the weighting clock", () => {
    const outcomes = [
      makeOutcome("angel", "regret", "It went badly.", NOW - 10 * DAY_MS),
    ];
    const record = buildTrackRecord(outcomes, NOW);
    expect(record.angelMemorableOutcome?.ageDays).toBe(10);
  });

  it("rounds weighted totals to 2 decimal places (no floating-point noise in output)", () => {
    const outcomes = [
      makeOutcome("angel", "good", undefined, NOW),
      makeOutcome("angel", "good", undefined, NOW - 7 * DAY_MS),
      makeOutcome("angel", "good", undefined, NOW - 13 * DAY_MS),
    ];
    const record = buildTrackRecord(outcomes, NOW);
    const decimalPlaces = (record.angelWeightedGood.toString().split(".")[1] ?? "").length;
    expect(decimalPlaces).toBeLessThanOrEqual(2);
  });
});
