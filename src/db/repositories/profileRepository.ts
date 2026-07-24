import type { CharacterProfile } from "../../types/index.js";
import { ANGEL_PROFILE, DEVIL_PROFILE } from "../../core/personalityEngine.js";

/**
 * Profiles are static personality definitions rather than mutable rows,
 * so this "repository" is a thin, consistent-naming wrapper rather than
 * a real SQL table. Kept separate from personalityEngine so the
 * mcp/resources layer has a single, predictable import path.
 */
export function getProfile(archetype: "angel" | "devil"): CharacterProfile {
  return archetype === "angel" ? ANGEL_PROFILE : DEVIL_PROFILE;
}

export function getAllProfiles(): CharacterProfile[] {
  return [ANGEL_PROFILE, DEVIL_PROFILE];
}
