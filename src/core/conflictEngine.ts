import {
  INTENSITY_VALUE,
  type ConflictEngineOutput,
  type Intensity,
  type RelationshipState,
  type SidePosition,
  type Winner,
} from "../types/index.js";
import { findTopicTemplate, type TopicTemplate } from "../prompts/conflict.js";
import { ANGEL_CLOSERS, ANGEL_OPENERS } from "../prompts/angel.js";
import { DEVIL_CLOSERS, DEVIL_OPENERS } from "../prompts/devil.js";

/** Threshold above which high cooperation makes a role reversal possible. */
const ROLE_REVERSAL_COOPERATION_THRESHOLD = 0.7;
/** Probability of a role reversal firing, once eligible. */
const ROLE_REVERSAL_CHANCE = 0.15;

const ANGEL_RESPECT_ACCOMMODATING_THRESHOLD = 0.7;
const DEVIL_ANNOYANCE_CONTRARIAN_THRESHOLD = 0.8;

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Scales how much reasoning text is shown based on intensity, and adds
 * theatrical openers/closers so low intensity reads as a quick aside and
 * high intensity reads as a dramatic monologue.
 */
function dramatizeReasoning(
  baseReasoning: string,
  intensityValue: number,
  side: "angel" | "devil"
): string {
  const opener = side === "angel" ? pick(ANGEL_OPENERS) : pick(DEVIL_OPENERS);
  const closer = side === "angel" ? pick(ANGEL_CLOSERS) : pick(DEVIL_CLOSERS);

  if (intensityValue <= 0.3) {
    // Low intensity: short, clipped, barely an aside.
    return `${opener} ${baseReasoning}`;
  }
  if (intensityValue <= 0.6) {
    // Medium intensity: opener + reasoning + closer.
    return `${opener} ${baseReasoning} ${closer}`;
  }
  // High intensity: full dramatic monologue with emphasis.
  return `${opener} ${baseReasoning} And honestly? ${closer}`;
}

/**
 * Sharpens a position statement's wording as intensity rises, without
 * changing its underlying stance — a "hotter take" on the same idea.
 */
function intensifyPosition(position: string, intensityValue: number): string {
  if (intensityValue <= 0.3) {
    return position;
  }
  if (intensityValue <= 0.6) {
    return `${position} Seriously.`;
  }
  return `${position.replace(/\.$/, "")} — no half measures.`;
}

interface BuildSideOptions {
  template: TopicTemplate;
  side: "angel" | "devil";
  intensityValue: number;
  relationship: RelationshipState;
}

function buildAngelSide({
  template,
  intensityValue,
  relationship,
}: BuildSideOptions): SidePosition {
  let { position, reasoning, concern } = template.angel;

  // Bias: high angel respect makes Angel more accommodating (less absolutist).
  if (relationship.angelRespect > ANGEL_RESPECT_ACCOMMODATING_THRESHOLD) {
    reasoning +=
      " That said, I'm not trying to control you — I just want it said out loud before you decide.";
  }

  return {
    position: intensifyPosition(position, intensityValue),
    reasoning: dramatizeReasoning(reasoning, intensityValue, "angel"),
    concern,
  };
}

function buildDevilSide({
  template,
  intensityValue,
  relationship,
}: BuildSideOptions): SidePosition {
  let { position, reasoning, temptation } = template.devil;

  // Bias: high devil annoyance makes Devil purely contrarian —
  // opposing whatever Angel says regardless of the topic's merits.
  if (relationship.devilAnnoyance > DEVIL_ANNOYANCE_CONTRARIAN_THRESHOLD) {
    position = "Whatever Angel just said, do the opposite.";
    reasoning =
      "Honestly, at this point I'd argue for the opposite of anything Angel says on principle. It's not even about this topic anymore.";
  }

  return {
    position: intensifyPosition(position, intensityValue),
    reasoning: dramatizeReasoning(reasoning, intensityValue, "devil"),
    temptation,
  };
}

/** Very rough heuristic for who "wins" a conflict, used for flavor + relationship updates. */
function determineLikelyWinner(
  relationship: RelationshipState,
  isRoleReversal: boolean
): Winner {
  // Slight bias toward whichever side currently has more respect banked,
  // with some randomness so it doesn't feel rigged.
  const angelOdds = 0.4 + relationship.angelRespect * 0.2;
  const devilOdds = 0.4 + relationship.devilRespect * 0.2;
  const total = angelOdds + devilOdds;
  const roll = Math.random() * total;

  let winner: Winner;
  if (roll < angelOdds * 0.9) {
    winner = "angel";
  } else if (roll < angelOdds + devilOdds * 0.9) {
    winner = "devil";
  } else {
    winner = "draw";
  }

  // Role reversal conflicts are framed as a wash more often — it's the
  // surprise, not the outcome, that matters.
  if (isRoleReversal && Math.random() < 0.3) {
    winner = "draw";
  }

  return winner;
}

export interface RunConflictParams {
  context: string;
  topic?: string;
  intensity: Intensity;
  relationship: RelationshipState;
}

/**
 * Runs the deterministic-but-randomized conflict engine:
 * 1. Selects a topic template via keyword match (or generic fallback).
 * 2. Possibly triggers a role reversal (Enhancement 3).
 * 3. Builds Angel/Devil positions with intensity scaling + relationship bias (Enhancement 2).
 */
export function runConflict({
  context,
  topic,
  intensity,
  relationship,
}: RunConflictParams): ConflictEngineOutput {
  const intensityValue = INTENSITY_VALUE[intensity];
  const searchText = [context, topic].filter(Boolean).join(" ");
  const template = findTopicTemplate(searchText);

  // --- Role Reversal (Enhancement 3) ---
  let isRoleReversal = false;
  if (relationship.cooperation > ROLE_REVERSAL_COOPERATION_THRESHOLD) {
    isRoleReversal = Math.random() < ROLE_REVERSAL_CHANCE;
  }

  // Under a role reversal, Angel gets the Devil's template content (and
  // vice versa) for this conflict only — archetypes swap, not the tags.
  // We build a single effective template so buildAngelSide/buildDevilSide
  // don't need to know reversal happened at all.
  const effectiveTemplate: TopicTemplate = isRoleReversal
    ? {
        keywords: template.keywords,
        coreDisagreement: template.coreDisagreement,
        angel: {
          position: template.devil.position,
          reasoning: template.devil.reasoning,
          concern: template.devil.temptation,
        },
        devil: {
          position: template.angel.position,
          reasoning: template.angel.reasoning,
          temptation: template.angel.concern,
        },
      }
    : template;

  const angel = buildAngelSide({
    template: effectiveTemplate,
    side: "angel",
    intensityValue,
    relationship,
  });

  const devil = buildDevilSide({
    template: effectiveTemplate,
    side: "devil",
    intensityValue,
    relationship,
  });

  const likelyWinner = determineLikelyWinner(relationship, isRoleReversal);

  return {
    angel,
    devil,
    coreDisagreement: template.coreDisagreement,
    likelyWinner,
    isRoleReversal,
    absurdityLevel: intensityValue,
  };
}

