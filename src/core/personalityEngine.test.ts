import { describe, expect, it } from "vitest";
import { CharacterProfileSchema } from "../types/index.js";
import {
  ANGEL_PROFILE,
  DEVIL_PROFILE,
  getProfileByArchetype,
} from "./personalityEngine.js";
import { formatProfile } from "./performanceInstructions.js";

describe("personality Voice Cards", () => {
  it("validates angel and devil profiles against the schema", () => {
    expect(() => CharacterProfileSchema.parse(ANGEL_PROFILE)).not.toThrow();
    expect(() => CharacterProfileSchema.parse(DEVIL_PROFILE)).not.toThrow();
  });

  it("exposes executable voice rails for both archetypes", () => {
    for (const profile of [ANGEL_PROFILE, DEVIL_PROFILE]) {
      expect(profile.voice.do.length).toBeGreaterThan(0);
      expect(profile.voice.dont.length).toBeGreaterThan(0);
      expect(profile.voice.signatureMoves.length).toBeGreaterThan(0);
      expect(profile.voice.never.length).toBeGreaterThan(0);
      expect(profile.voice.cadence.length).toBeGreaterThan(0);
      expect(profile.voice.secretLeak).toBeTruthy();
      expect(profile.voiceZh).toBeTruthy();
      expect(profile.voiceZh!.do.length).toBeGreaterThan(0);
      expect(profile.voiceZh!.cadence.length).toBeGreaterThan(0);
    }
  });

  it("keeps angel and devil cadence fingerprints distinct", () => {
    expect(ANGEL_PROFILE.voice.cadence).toMatch(/soft question|measured/i);
    expect(DEVIL_PROFILE.voice.cadence).toMatch(/jab|spik|short/i);
    expect(ANGEL_PROFILE.voice.do.join(" ")).not.toEqual(
      DEVIL_PROFILE.voice.do.join(" "),
    );
    expect(ANGEL_PROFILE.voiceZh!.cadence).toMatch(/软问|稳/);
    expect(DEVIL_PROFILE.voiceZh!.cadence).toMatch(/短句|刺/);
    expect(ANGEL_PROFILE.voiceZh!.do.join(" ")).not.toEqual(
      DEVIL_PROFILE.voiceZh!.do.join(" "),
    );
  });

  it("formatProfile expands Voice Card sections for the Client LLM", () => {
    const text = formatProfile(ANGEL_PROFILE);
    expect(text).toContain("VOICE CARD");
    expect(text).toMatch(/\bDO:/);
    expect(text).toMatch(/DON'T:/);
    expect(text).toMatch(/CADENCE:/);
    expect(text).toMatch(/SIGNATURE MOVES:/);
    expect(text).toMatch(/\bNEVER:/);
    expect(text).toMatch(/SECRET LEAK/);
    expect(text).toContain(ANGEL_PROFILE.voice.cadence);
  });

  it("formatProfile prefers Chinese Voice Card when locale is zh", () => {
    const text = formatProfile(DEVIL_PROFILE, { locale: "zh" });
    expect(text).toMatch(/VOICE CARD ZH/);
    expect(text).toContain(DEVIL_PROFILE.voiceZh!.cadence);
    expect(text).not.toContain(DEVIL_PROFILE.voice.cadence);
    expect(text).toMatch(/得了吧|损友|机会成本|短句/);
  });

  it("getProfileByArchetype returns the static cards", () => {
    expect(getProfileByArchetype("angel")).toBe(ANGEL_PROFILE);
    expect(getProfileByArchetype("devil")).toBe(DEVIL_PROFILE);
  });
});
