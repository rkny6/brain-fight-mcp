import { describe, expect, it } from "vitest";
import { detectNewMilestones } from "./milestoneEngine.js";
import { DEFAULT_RELATIONSHIP_STATE } from "../types/index.js";
import type { ConflictRecord, MilestoneKey, RelationshipState, Winner } from "../types/index.js";

function makeRelationship(overrides: Partial<RelationshipState> = {}): RelationshipState {
  return {
    sessionId: "s",
    domain: "general",
    ...DEFAULT_RELATIONSHIP_STATE,
    ...overrides,
  };
}

let seq = 0;
function makeConflict(winner: Winner): ConflictRecord {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    sessionId: "s",
    domain: "general",
    context: "filler",
    angelPosition: "a",
    devilPosition: "d",
    winner,
    absurdityLevel: 0.5,
    createdAt: Date.now(),
  };
}

const noneReached = new Set<MilestoneKey>();

describe("detectNewMilestones", () => {
  it("fires high_cooperation only when crossing 0.9 upward for the first time", () => {
    const hits = detectNewMilestones({
      before: makeRelationship({ cooperation: 0.85 }),
      after: makeRelationship({ cooperation: 0.91 }),
      recentConflicts: [],
      alreadyReached: noneReached,
    });
    expect(hits.map((h) => h.key)).toContain("high_cooperation");
  });

  it("does NOT fire high_cooperation if already above threshold before this round", () => {
    const hits = detectNewMilestones({
      before: makeRelationship({ cooperation: 0.92 }),
      after: makeRelationship({ cooperation: 0.95 }),
      recentConflicts: [],
      alreadyReached: noneReached,
    });
    expect(hits.map((h) => h.key)).not.toContain("high_cooperation");
  });

  it("does NOT re-fire a milestone already in alreadyReached", () => {
    const hits = detectNewMilestones({
      before: makeRelationship({ cooperation: 0.85 }),
      after: makeRelationship({ cooperation: 0.95 }),
      recentConflicts: [],
      alreadyReached: new Set<MilestoneKey>(["high_cooperation"]),
    });
    expect(hits.map((h) => h.key)).not.toContain("high_cooperation");
  });

  it("fires devil_streak_5 when the 5 most recent conflicts were all devil wins", () => {
    const recent = [
      makeConflict("devil"),
      makeConflict("devil"),
      makeConflict("devil"),
      makeConflict("devil"),
      makeConflict("devil"),
      makeConflict("angel"), // 6th (older) — irrelevant, only first 5 matter
    ];
    const hits = detectNewMilestones({
      before: makeRelationship(),
      after: makeRelationship(),
      recentConflicts: recent,
      alreadyReached: noneReached,
    });
    expect(hits.map((h) => h.key)).toContain("devil_streak_5");
    expect(hits.map((h) => h.key)).not.toContain("angel_streak_5");
  });

  it("does NOT fire a streak if the run is broken anywhere in the last 5", () => {
    const recent = [
      makeConflict("devil"),
      makeConflict("devil"),
      makeConflict("draw"), // breaks it
      makeConflict("devil"),
      makeConflict("devil"),
    ];
    const hits = detectNewMilestones({
      before: makeRelationship(),
      after: makeRelationship(),
      recentConflicts: recent,
      alreadyReached: noneReached,
    });
    expect(hits.map((h) => h.key)).not.toContain("devil_streak_5");
  });

  it("does NOT fire a streak with fewer than 5 conflicts on record", () => {
    const recent = [makeConflict("devil"), makeConflict("devil")];
    const hits = detectNewMilestones({
      before: makeRelationship(),
      after: makeRelationship(),
      recentConflicts: recent,
      alreadyReached: noneReached,
    });
    expect(hits.map((h) => h.key)).not.toContain("devil_streak_5");
  });

  it("fires conflicts_10 exactly when totalConflicts crosses 10, not before or after", () => {
    const at10 = detectNewMilestones({
      before: makeRelationship({ totalConflicts: 9 }),
      after: makeRelationship({ totalConflicts: 10 }),
      recentConflicts: [],
      alreadyReached: noneReached,
    });
    expect(at10.map((h) => h.key)).toContain("conflicts_10");

    const at11 = detectNewMilestones({
      before: makeRelationship({ totalConflicts: 10 }),
      after: makeRelationship({ totalConflicts: 11 }),
      recentConflicts: [],
      alreadyReached: noneReached,
    });
    expect(at11.map((h) => h.key)).not.toContain("conflicts_10");
  });

  it("can fire multiple milestones in the same round", () => {
    const recent = [
      makeConflict("angel"),
      makeConflict("angel"),
      makeConflict("angel"),
      makeConflict("angel"),
      makeConflict("angel"),
    ];
    const hits = detectNewMilestones({
      before: makeRelationship({ cooperation: 0.8, totalConflicts: 9 }),
      after: makeRelationship({ cooperation: 0.95, totalConflicts: 10 }),
      recentConflicts: recent,
      alreadyReached: noneReached,
    });
    const keys = hits.map((h) => h.key).sort();
    expect(keys).toEqual(["angel_streak_5", "conflicts_10", "high_cooperation"]);
  });

  it("returns an empty array when nothing new is crossed", () => {
    const hits = detectNewMilestones({
      before: makeRelationship({ totalConflicts: 3, cooperation: 0.3 }),
      after: makeRelationship({ totalConflicts: 4, cooperation: 0.32 }),
      recentConflicts: [makeConflict("angel"), makeConflict("devil")],
      alreadyReached: noneReached,
    });
    expect(hits).toEqual([]);
  });
});
