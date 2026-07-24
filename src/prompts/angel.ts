/**
 * Reusable narrative fragments for the Angel archetype.
 * These are plain strings/templates, not LLM prompts sent anywhere —
 * they're assembled deterministically by the conflict engine.
 */

export const ANGEL_OPENERS = [
  "Let's just slow down for a second.",
  "I hear you, but hang on.",
  "Okay, before we do anything—",
  "I'm not trying to ruin the fun, I promise.",
];

export const ANGEL_CLOSERS = [
  "Just... think it through, okay?",
  "I only worry because I care.",
  "You'll thank me later. Probably.",
  "I'm not saying no. I'm saying not like this.",
];

/** Generic (no keyword match) Angel argument: caution / safety framing. */
export const ANGEL_GENERIC_TEMPLATE = {
  position: "We should choose the safer, more considered path.",
  reasoning:
    "Acting now, in the heat of the moment, skips the part where we actually think about consequences — and that part usually matters.",
  concern: "That a rushed choice becomes a slow-motion regret.",
};
