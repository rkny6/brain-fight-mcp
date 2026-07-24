import type { ConflictEngineOutput } from "../types/index.js";

/**
 * Builds the `performance_instructions` string for a full conflict
 * (start_inner_conflict). This is the single most important field for
 * making the Client LLM actually perform the debate instead of
 * summarizing the JSON at the user.
 */
export function buildConflictPerformanceInstructions(
  output: ConflictEngineOutput
): string {
  const { isRoleReversal, absurdityLevel } = output;

  const pacing =
    absurdityLevel >= 0.75
      ? "fast-paced, snappy, and slightly unhinged"
      : absurdityLevel >= 0.45
      ? "brisk but conversational, with real back-and-forth"
      : "low-key and understated, almost a passing thought";

  const lines = [
    "Narrate a short debate between Angel and Devil. Do not summarize the JSON — act out the positions as dialogue.",
    "Angel speaks with calm anxiety, occasionally a little wounded. Devil speaks with sarcastic confidence and enjoys the jab.",
    `Absurdity level is ${absurdityLevel.toFixed(2)}, so keep the pacing ${pacing}.`,
  ];

  if (isRoleReversal) {
    lines.push(
      "IMPORTANT: this conflict is a role reversal — Angel is arguing the reckless position and Devil is arguing caution. Both characters should visibly notice this is unusual and comment on how weird it feels before diving into their (swapped) arguments."
    );
  }

  lines.push(
    "End with a clear sense of which side is currently winning the human over, without being preachy about it."
  );

  return lines.join(" ");
}

/** Simpler performance instructions for a single-character summon (no conflict). */
export function buildSummonPerformanceInstructions(
  archetype: "angel" | "devil"
): string {
  if (archetype === "angel") {
    return "Speak as Angel: calm, earnest, a little anxious. Give the perspective directly to the user as first-person advice, not a report. Keep it warm, not preachy.";
  }
  return "Speak as Devil: sharp, confident, a little sarcastic. Give the perspective directly to the user as first-person advice, not a report. Keep it fun, not actually harmful.";
}
