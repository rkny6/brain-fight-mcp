import type { ConflictRecord, Winner } from "../types/index.js";

/**
 * Structured "callback hooks" derived from the most recent prior conflict.
 * These are injected into Angel/Devil reasoning and performance_instructions
 * so multi-round debates can reference last round without relying on the
 * Client LLM's chat memory alone.
 */
export interface ContinuityHooks {
  /** True when we have at least one prior conflict to reference. */
  hasPrior: boolean;
  prior: {
    context: string;
    angelPosition: string;
    devilPosition: string;
    winner: Winner;
  } | null;
  /** Short line appended into Angel's reasoning (empty if none). */
  angelCallback: string;
  /** Short line appended into Devil's reasoning (empty if none). */
  devilCallback: string;
  /** Extra sentence(s) for performance_instructions. */
  performanceNote: string;
}

const EMPTY_HOOKS: ContinuityHooks = {
  hasPrior: false,
  prior: null,
  angelCallback: "",
  devilCallback: "",
  performanceNote: "",
};

/**
 * Builds continuity hooks from the newest prior conflict (if any).
 * `priors` is expected newest-first (as returned by recall/getRecentConflicts).
 */
export function buildContinuityHooks(
  priors: ConflictRecord[]
): ContinuityHooks {
  const prior = priors[0];
  if (!prior) {
    return EMPTY_HOOKS;
  }

  const angelSaid = clip(prior.angelPosition, 120);
  const devilSaid = clip(prior.devilPosition, 120);
  const winnerLabel = formatWinner(prior.winner);

  // Angel: either doubles down after a win, or re-grounds after a loss/draw.
  let angelCallback: string;
  if (prior.winner === "angel") {
    angelCallback = `Last round I argued "${angelSaid}" and it landed — this new question still has to be consistent with that, not a quiet retreat.`;
  } else if (prior.winner === "devil") {
    angelCallback = `Last round Devil got the better of me when I said "${angelSaid}". I need to answer this without contradicting that, and without just restating the same caution.`;
  } else {
    angelCallback = `Last round we stalemated. I said "${angelSaid}" — whatever I say now should advance that line, not reset as if the previous exchange never happened.`;
  }

  // Devil: weaponizes Angel's prior quote (the classic "gotcha") and rides a prior win.
  let devilCallback: string;
  if (prior.winner === "devil") {
    devilCallback = `Last round I won with "${devilSaid}". Don't let Angel reframe this as a brand-new problem — pin them to what they already admitted: "${angelSaid}".`;
  } else if (prior.winner === "angel") {
    devilCallback = `Angel scored last time with "${angelSaid}". The move now is to show that their new standard collapses under that same quote — or that they are moving the goalposts.`;
  } else {
    devilCallback = `Last round was a draw. Angel's line was "${angelSaid}"; mine was "${devilSaid}". Use their own words against any softer, more convenient standard they float now.`;
  }

  const performanceNote = [
    "CONTINUITY (required): this is a follow-up round, not a cold open.",
    `Previous context: "${clip(prior.context, 160)}".`,
    `Last round Angel argued: "${angelSaid}".`,
    `Last round Devil argued: "${devilSaid}".`,
    `Last round winner: ${winnerLabel}.`,
    "At least one character must explicitly quote or paraphrase a prior-round position (ideally Angel's, as a gotcha or a consistency check) before the new argument fully lands.",
    "Do not pretend this is the first time they have discussed the broader situation.",
  ].join(" ");

  return {
    hasPrior: true,
    prior: {
      context: prior.context,
      angelPosition: prior.angelPosition,
      devilPosition: prior.devilPosition,
      winner: prior.winner,
    },
    angelCallback,
    devilCallback,
    performanceNote,
  };
}

/** Appends a continuity callback onto a reasoning string when present. */
export function applyCallbackToReasoning(
  reasoning: string,
  callback: string
): string {
  if (!callback) {
    return reasoning;
  }
  return `${reasoning} ${callback}`;
}

function clip(text: string, max: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) {
    return cleaned;
  }
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

function formatWinner(winner: Winner): string {
  if (winner === "angel") return "Angel";
  if (winner === "devil") return "Devil";
  if (winner === "draw") return "draw";
  return "unclear";
}
