import {
  INTENSITY_VALUE,
  type ConflictEngineOutput,
  type ConflictRecord,
  type ConflictSeed,
  type ConstraintSeed,
  type DebateBrief,
  type Intensity,
  type LegacyStanceSeed,
  type RelationshipState,
  type SidePosition,
  type Winner,
} from "../types/index.js";
import {
  extractUserDetails,
  findTopicTemplateDetailed,
  type TopicTemplate,
} from "../prompts/conflict.js";
import {
  applyCallbackToReasoning,
  buildContinuityHooks,
  type ContinuityHooks,
} from "./continuityEngine.js";

/** Threshold above which high cooperation makes a role reversal possible. */
const ROLE_REVERSAL_COOPERATION_THRESHOLD = 0.7;
/** Probability of a role reversal firing, once eligible. */
const ROLE_REVERSAL_CHANCE = 0.15;

const ANGEL_RESPECT_ACCOMMODATING_THRESHOLD = 0.7;
const DEVIL_ANNOYANCE_CONTRARIAN_THRESHOLD = 0.8;

interface BuildSideOptions {
  template: TopicTemplate;
  side: "angel" | "devil";
  relationship: RelationshipState;
  continuity: ContinuityHooks;
}

/** True when the seed is the preferred constraint-axis form. */
export function isConstraintSeed(seed: ConflictSeed): seed is ConstraintSeed {
  return (
    typeof seed === "object" &&
    seed !== null &&
    "tension" in seed &&
    "angelMust" in seed &&
    "devilMust" in seed
  );
}

/** True when the seed is the legacy full-stance form. */
export function isLegacyStanceSeed(seed: ConflictSeed): seed is LegacyStanceSeed {
  return (
    typeof seed === "object" &&
    seed !== null &&
    "coreDisagreement" in seed &&
    "angelPosition" in seed
  );
}

/**
 * Builds plain seed stances for the Client LLM.
 *
 * Intentionally does NOT splice theatrical openers/closers or intensity
 * suffix phrases ("Seriously.", "no half measures") into position/reasoning —
 * those made performance seeds sound like a fixed script. Intensity still
 * drives absurdityLevel / performance_instructions pacing instead.
 */
function buildAngelSide({
  template,
  relationship,
  continuity,
}: BuildSideOptions): SidePosition {
  let { position, reasoning, concern } = template.angel;

  // Bias: high angel respect makes Angel more accommodating (less absolutist).
  if (relationship.angelRespect > ANGEL_RESPECT_ACCOMMODATING_THRESHOLD) {
    reasoning +=
      " That said, I'm not trying to control you — I just want it said out loud before you decide.";
  }

  reasoning = applyCallbackToReasoning(reasoning, continuity.angelCallback);

  return {
    position,
    reasoning,
    concern,
  };
}

function buildDevilSide({
  template,
  relationship,
  continuity,
}: BuildSideOptions): SidePosition {
  let { position, reasoning, temptation } = template.devil;

  // Bias: high devil annoyance makes Devil purely contrarian —
  // opposing whatever Angel says regardless of the topic's merits.
  if (relationship.devilAnnoyance > DEVIL_ANNOYANCE_CONTRARIAN_THRESHOLD) {
    position = "Whatever Angel just said, do the opposite.";
    reasoning =
      "Honestly, at this point I'd argue for the opposite of anything Angel says on principle. It's not even about this topic anymore.";
  }

  reasoning = applyCallbackToReasoning(reasoning, continuity.devilCallback);

  return {
    position,
    reasoning,
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

/**
 * Constraint seed → lightweight SidePosition rails (not recitable monologues).
 * reasoning stays empty so performance_instructions prefer CONSTRAINT AXES.
 */
function constraintSeedToTemplate(seed: ConstraintSeed): TopicTemplate {
  return {
    keywords: [],
    coreDisagreement: seed.tension,
    angel: {
      position: seed.angelMust,
      reasoning: "",
      concern: seed.angelMust,
    },
    devil: {
      position: seed.devilMust,
      reasoning: "",
      temptation: seed.devilMust,
    },
  };
}

/** Legacy full-stance seed → TopicTemplate (still accepted for compatibility). */
function legacySeedToTemplate(seed: LegacyStanceSeed): TopicTemplate {
  return {
    keywords: [],
    coreDisagreement: seed.coreDisagreement,
    angel: {
      position: seed.angelPosition,
      reasoning: seed.angelReasoning,
      concern: seed.angelConcern,
    },
    devil: {
      position: seed.devilPosition,
      reasoning: seed.devilReasoning,
      temptation: seed.devilTemptation,
    },
  };
}

/**
 * Converts a caller-supplied seed into a TopicTemplate shape so it can flow
 * through role-reversal + relationship-bias + continuity unchanged.
 */
export function seedToTemplate(seed: ConflictSeed): TopicTemplate {
  if (isConstraintSeed(seed)) {
    return constraintSeedToTemplate(seed);
  }
  return legacySeedToTemplate(seed);
}

function briefFromConstraintSeed(seed: ConstraintSeed): DebateBrief {
  return {
    tension: seed.tension,
    angelMust: seed.angelMust,
    devilMust: seed.devilMust,
    userDetails: seed.userDetails ?? [],
    forbidden: seed.forbidden ?? [],
    source: "constraint_seed",
  };
}

function briefFromLegacySeed(seed: LegacyStanceSeed): DebateBrief {
  return {
    tension: seed.coreDisagreement,
    angelMust: seed.angelPosition,
    devilMust: seed.devilPosition,
    userDetails: [],
    forbidden: [],
    source: "legacy_seed",
  };
}

function briefFromTemplate(
  template: TopicTemplate,
  situationText: string,
  match: "keyword" | "overlap" | "generic",
): DebateBrief {
  const userDetails = extractUserDetails(situationText);
  const forbidden =
    match === "generic"
      ? [
          "generic safety vs freedom slogan as the whole argument",
          "life-advice pamphlet tone with no user facts",
        ]
      : [
          "recite the canned topic template verbatim",
          "ignore concrete user_details from the situation",
        ];

  return {
    tension: template.coreDisagreement,
    angelMust: template.angel.position,
    devilMust: template.devil.position,
    userDetails,
    forbidden,
    source: "template",
  };
}

/** Swap angel/devil musts when role reversal fires. */
function applyRoleReversalToBrief(brief: DebateBrief): DebateBrief {
  return {
    ...brief,
    angelMust: brief.devilMust,
    devilMust: brief.angelMust,
  };
}

export interface RunConflictParams {
  context: string;
  topic?: string;
  intensity: Intensity;
  relationship: RelationshipState;
  priorConflicts?: ConflictRecord[];
  seed?: ConflictSeed;
}

/**
 * Runs the deterministic-but-randomized conflict engine:
 * 1. Selects constraint/legacy seed, or (no seed) best keyword/overlap template,
 *    else generic Safety-vs-Freedom — always extracting userDetails from context.
 * 2. Possibly triggers a role reversal (Enhancement 3).
 * 3. Builds plain Angel/Devil SidePosition rails with relationship bias.
 * 4. Injects continuity callbacks from the previous conflict.
 * 5. Emits a normalized DebateBrief for performance_instructions (constraint axes).
 * Intensity still sets absurdityLevel / Client pacing; it does not rewrite seed wording.
 */
export function runConflict({
  context,
  topic,
  intensity,
  relationship,
  priorConflicts = [],
  seed,
}: RunConflictParams): ConflictEngineOutput {
  const intensityValue = INTENSITY_VALUE[intensity];
  // Prefer the caller's situation-specific seed. Only fall back to
  // keyword/overlap-matched templates (and ultimately the generic template) when
  // no seed was supplied. Even then, extract concrete userDetails from context so
  // performance_instructions stay grounded instead of pure life-advice soup.
  let template: TopicTemplate;
  let brief: DebateBrief;
  if (seed) {
    template = seedToTemplate(seed);
    brief = isConstraintSeed(seed)
      ? briefFromConstraintSeed(seed)
      : briefFromLegacySeed(seed);
    // Legacy seeds often omit userDetails — backfill from free-form context.
    if (
      !isConstraintSeed(seed) &&
      (!brief.userDetails || brief.userDetails.length === 0)
    ) {
      brief = {
        ...brief,
        userDetails: extractUserDetails(
          [context, topic].filter(Boolean).join(" "),
        ),
      };
    }
  } else {
    const situation = [context, topic].filter(Boolean).join(" ");
    const found = findTopicTemplateDetailed(situation);
    template = found.template;
    brief = briefFromTemplate(template, situation, found.match);
  }
  const continuityHooks = buildContinuityHooks(priorConflicts);

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

  if (isRoleReversal) {
    brief = applyRoleReversalToBrief(brief);
  }

  const angel = buildAngelSide({
    template: effectiveTemplate,
    side: "angel",
    relationship,
    continuity: continuityHooks,
  });

  const devil = buildDevilSide({
    template: effectiveTemplate,
    side: "devil",
    relationship,
    continuity: continuityHooks,
  });

  const likelyWinner = determineLikelyWinner(relationship, isRoleReversal);

  return {
    angel,
    devil,
    coreDisagreement: template.coreDisagreement,
    likelyWinner,
    isRoleReversal,
    absurdityLevel: intensityValue,
    continuity: {
      hasPrior: continuityHooks.hasPrior,
      prior: continuityHooks.prior,
      angelCallback: continuityHooks.angelCallback,
      devilCallback: continuityHooks.devilCallback,
    },
    brief,
  };
}
