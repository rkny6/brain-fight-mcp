import { describe, expect, it } from "vitest";
import {
  applyCallbackToReasoning,
  buildContinuityHooks,
} from "./continuityEngine.js";
import type { ConflictRecord } from "../types/index.js";

function makePrior(overrides: Partial<ConflictRecord> = {}): ConflictRecord {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    sessionId: "test",
    context: "Should I quit my job?",
    topic: "job",
    angelPosition: "Don't quit yet — line something up first.",
    devilPosition: "Quit. Today. Send the email.",
    winner: "angel",
    absurdityLevel: 0.6,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("continuityEngine.buildContinuityHooks", () => {
  it("returns empty hooks when there is no prior conflict", () => {
    const hooks = buildContinuityHooks([]);
    expect(hooks.hasPrior).toBe(false);
    expect(hooks.prior).toBeNull();
    expect(hooks.angelCallback).toBe("");
    expect(hooks.devilCallback).toBe("");
    expect(hooks.performanceNote).toBe("");
  });

  it("builds callbacks that quote prior positions after an angel win", () => {
    const prior = makePrior({ winner: "angel" });
    const hooks = buildContinuityHooks([prior]);

    expect(hooks.hasPrior).toBe(true);
    expect(hooks.prior?.winner).toBe("angel");
    expect(hooks.angelCallback).toContain(prior.angelPosition);
    expect(hooks.angelCallback.toLowerCase()).toMatch(/landed|consistent/);
    expect(hooks.devilCallback).toContain(prior.angelPosition);
    expect(hooks.devilCallback.toLowerCase()).toMatch(/goalpost|scored|quote/);
    expect(hooks.performanceNote).toContain("CONTINUITY");
    expect(hooks.performanceNote).toContain(prior.context);
  });

  it("lets Devil ride a prior win and pin Angel to their old words", () => {
    const prior = makePrior({
      winner: "devil",
      angelPosition: "Panic is a normal signal, not a red light.",
      devilPosition: "Leave while the window is open.",
    });
    const hooks = buildContinuityHooks([prior]);

    expect(hooks.devilCallback).toContain("Leave while the window is open.");
    expect(hooks.devilCallback).toContain("Panic is a normal signal");
    expect(hooks.angelCallback.toLowerCase()).toMatch(/devil|better|contradict/);
  });

  it("uses only the newest prior when multiple are provided", () => {
    const older = makePrior({
      id: "00000000-0000-4000-8000-000000000002",
      context: "older context",
      angelPosition: "older angel line",
    });
    const newer = makePrior({
      id: "00000000-0000-4000-8000-000000000003",
      context: "newer context",
      angelPosition: "newer angel line",
      winner: "draw",
    });

    const hooks = buildContinuityHooks([newer, older]);
    expect(hooks.prior?.context).toBe("newer context");
    expect(hooks.angelCallback).toContain("newer angel line");
    expect(hooks.angelCallback).not.toContain("older angel line");
  });
});

describe("continuityEngine.applyCallbackToReasoning", () => {
  it("appends a callback when present", () => {
    expect(applyCallbackToReasoning("Base.", "Callback.")).toBe("Base. Callback.");
  });

  it("leaves reasoning unchanged when callback is empty", () => {
    expect(applyCallbackToReasoning("Base.", "")).toBe("Base.");
  });
});
