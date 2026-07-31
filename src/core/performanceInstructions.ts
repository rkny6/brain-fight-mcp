import type {
  ActiveConflict,
  CharacterProfile,
  DebateBrief,
  Intensity,
  RelationshipState,
  SidePosition,
  Speaker,
  VoiceCard,
} from "../types/index.js";
import { ANGEL_PROFILE, DEVIL_PROFILE } from "./personalityEngine.js";
import { isChineseText } from "../prompts/conflict.js";

export interface TurnPerformanceContext {
  conflict: ActiveConflict;
  speaker: Speaker;
  turnIndex: number;
  maxTurns: number;
  isDoubleTap: boolean;
  relationship: RelationshipState;
  userInterjection?: string;
  lastUtterance?: string;
  angelProfile?: CharacterProfile;
  devilProfile?: CharacterProfile;
}

/** Shared anti-template rules for Client LLM performance. */
function antiTemplateRules(userContext: string, topic?: string): string[] {
  const situation = [userContext, topic].filter(Boolean).join(" | ");
  return [
    `USER'S EXACT SITUATION (cite from this, not from abstract slogans): ${situation}`,
    "GROUNDING (required): Weave in at least TWO concrete nouns/facts from the user's situation (names, deadlines, money amounts, people, places, constraints). Do not debate a generic life-advice topic.",
    "ANTI-RECITE (required): Constraint axes and any leftover seed rails are NOT dialogue. Do NOT quote tension/must/position/reasoning/concern/temptation verbatim or near-verbatim (no multi-word copy-paste). Invent fresh lines; keep only the underlying side of the conflict.",
    'Avoid canned openers/closers and stock intensity tags. Do not rely on phrases like "Seriously.", "no half measures", or abstract Safety-vs-Freedom slogans unless the user literally framed it that way.',
  ];
}

export interface EndConflictPerformanceContext {
  conflict: ActiveConflict;
  winner:
    | NonNullable<ActiveConflict["likelyWinner"]>
    | "angel"
    | "devil"
    | "draw";
  relationship: RelationshipState;
  /** Optional real-world track record from recorded outcomes, if any exist yet. */
  trackRecord?: {
    totalRecorded: number;
    angelChoiceCount: number;
    devilChoiceCount: number;
    angelChoiceGoodCount: number;
    angelChoiceRegretCount: number;
    devilChoiceGoodCount: number;
    devilChoiceRegretCount: number;
  };
}

/** Resolve which Voice Card to use for performance (zh when available). */
export function resolveVoiceCard(
  profile: CharacterProfile,
  locale: "en" | "zh" = "en",
): VoiceCard {
  if (locale === "zh" && profile.voiceZh) {
    return profile.voiceZh;
  }
  return profile.voice;
}

export function detectPerformanceLocale(
  ...texts: Array<string | undefined>
): "en" | "zh" {
  const joined = texts.filter(Boolean).join("\n");
  return isChineseText(joined) ? "zh" : "en";
}

/** Expand a profile into director-style CAST lines for the Client LLM. */
export function formatProfile(
  profile: CharacterProfile,
  options: { locale?: "en" | "zh" } = {},
): string {
  const locale = options.locale ?? "en";
  const voice = resolveVoiceCard(profile, locale);
  const cardLabel =
    locale === "zh"
      ? "VOICE CARD ZH (中文语气指纹 — 用中文表演；发明措辞，不要当清单背诵)"
      : "VOICE CARD (follow these rails; invent wording, do not recite as a checklist monologue)";
  const lines = [
    `${profile.name} (${profile.archetype})`,
    `traits: ${profile.traits.join(", ")}`,
    `values: ${profile.values.join(", ")}`,
    `summary: ${profile.speakingStyle}`,
    `${cardLabel}:`,
    `  DO: ${voice.do.join(" | ")}`,
    `  DON'T: ${voice.dont.join(" | ")}`,
    `  CADENCE: ${voice.cadence}`,
    `  SIGNATURE MOVES: ${voice.signatureMoves.join(" | ")}`,
    `  NEVER: ${voice.never.join(" | ")}`,
  ];
  if (voice.secretLeak) {
    lines.push(
      locale === "zh"
        ? `  SECRET LEAK (可偶尔漏一点): ${voice.secretLeak}`
        : `  SECRET LEAK (optional, sparingly): ${voice.secretLeak}`,
    );
  }
  return lines.join("\n");
}

function languagePerformanceRules(locale: "en" | "zh"): string[] {
  if (locale === "zh") {
    return [
      "LANGUAGE: 用户用中文 — 对白与收尾行动建议都必须用中文。",
      "中文声线：严格按 VOICE CARD ZH 的节奏与口头习惯演，避免两边都变成同一套正式「辩论体」。",
      "Angel 更像担心你的朋友；Devil 更像损友/抬杠搭子。保留角色差，不要互译成英文腔中文。",
    ];
  }
  return [
    "LANGUAGE: User wrote in English — perform in English unless they switch.",
  ];
}

/**
 * Relationship → delivery modifiers for the Client LLM.
 * Stance still comes from constraint axes / seeds; these change how they talk
 * (cadence pressure, address style, heat), not which slogan they recite.
 *
 * When `speaker` is set (turn mode), emit that side's rails first and keep
 * dyad/opponent notes short so the single speaker does not over-play both roles.
 */
export function relationshipToneModifiers(
  relationship: RelationshipState,
  options: { speaker?: Speaker } = {},
): string[] {
  const { speaker } = options;
  const includeAngel = !speaker || speaker === "angel";
  const includeDevil = !speaker || speaker === "devil";
  const lines: string[] = [];

  if (includeAngel) {
    if (relationship.angelRespect >= 0.7) {
      lines.push(
        "Angel TONE: high respect banked — more collaborative 'we', less absolutist, still principled; offer a partial win or reversible step instead of a lecture.",
      );
    } else if (relationship.angelRespect <= 0.35) {
      lines.push(
        "Angel TONE: low respect — tighter, more insistent, slightly wounded if brushed off; repeat the concrete risk once, not five moral slogans.",
      );
    } else {
      lines.push(
        "Angel TONE: mid respect — measured care; neither overly deferential nor brittle.",
      );
    }

    if (relationship.angelAnnoyance >= 0.7) {
      lines.push(
        "Angel HEAT: annoyance high — thinner patience, sharper guilt, shorter sentences; still protective, not cruel.",
      );
    } else if (relationship.angelAnnoyance <= 0.25) {
      lines.push(
        "Angel HEAT: low annoyance — warmer baseline, more soft questions, less edge.",
      );
    }
  } else {
    // Turn-mode Devil: one compact note about how Angel is landing on them.
    if (relationship.angelRespect >= 0.7) {
      lines.push(
        "Opponent vibe: Angel is currently well-respected — undercutting them takes more charm than mockery.",
      );
    } else if (relationship.angelRespect <= 0.35) {
      lines.push(
        "Opponent vibe: Angel is feeling dismissed — they may dig in; a jab lands easier but cheap shots waste the bit.",
      );
    }
  }

  if (includeDevil) {
    if (relationship.devilRespect >= 0.7) {
      lines.push(
        "Devil TONE: high respect banked — cockier, assumes the human might actually listen; sell the bold path with confidence, not desperation.",
      );
    } else if (relationship.devilRespect <= 0.35) {
      lines.push(
        "Devil TONE: low respect — try harder without begging; flashier dare, tighter jab, more needling of Angel's frame.",
      );
    } else {
      lines.push(
        "Devil TONE: mid respect — sharp and playful; delivery over purity of logic.",
      );
    }

    if (relationship.devilAnnoyance >= 0.8) {
      lines.push(
        "Devil HEAT: annoyance very high — contrarian, shorter jabs, little patience for Angel's framing; oppose the frame, not the user's dignity.",
      );
    } else if (relationship.devilAnnoyance <= 0.3) {
      lines.push(
        "Devil HEAT: low annoyance — cocky and playful rather than bitter; tease, don't seethe.",
      );
    }
  } else {
    if (relationship.devilAnnoyance >= 0.8) {
      lines.push(
        "Opponent vibe: Devil is highly annoyed — expect sharper interruptions; do not mirror pure spite; stay Angel.",
      );
    } else if (relationship.devilRespect >= 0.7) {
      lines.push(
        "Opponent vibe: Devil is riding high respect — they will sound more persuasive; counter with concrete cost, not volume.",
      );
    }
  }

  // Dyad dynamics always color address style.
  if (relationship.cooperation >= 0.7) {
    lines.push(
      "DYAD: high cooperation — may finish each other's thoughts or briefly acknowledge a fair point, then still disagree hard; banter allowed.",
    );
  } else if (relationship.cooperation <= 0.25) {
    lines.push(
      "DYAD: low cooperation — chilly, competitive, little goodwill; colder address, minimal credit to the other side.",
    );
  } else {
    lines.push(
      "DYAD: mid cooperation — normal sparring; some friction, not open war.",
    );
  }

  if (relationship.totalConflicts > 0 && relationship.recentWinner) {
    const residual =
      relationship.recentWinner === "draw"
        ? "last round ended in a draw — residual unresolved tension / mutual side-eye"
        : `recent winner was ${relationship.recentWinner} — let that residual swagger or bruise color the opening only`;
    lines.push(
      `SESSION RESIDUE: after ${relationship.totalConflicts} prior conflict(s), ${residual}. Do not re-litigate the whole prior case.`,
    );
  }

  return lines;
}

/** Prefer engine brief; fall back to SidePosition rails for older active rows. */
export function resolveBrief(
  brief: DebateBrief | undefined,
  coreDisagreement: string,
  angel: SidePosition,
  devil: SidePosition,
): DebateBrief {
  if (brief) {
    return brief;
  }
  return {
    tension: coreDisagreement,
    angelMust: angel.position,
    devilMust: devil.position,
    userDetails: [],
    forbidden: [],
    source: "template",
  };
}

/** CONSTRAINT AXES block — primary performance rails (not recitable monologue). */
export function formatConstraintAxes(
  brief: DebateBrief,
  speaker?: Speaker,
): string[] {
  const lines = [
    "CONSTRAINT AXES (invent all dialogue from these rails — they are NOT finished lines to recite):",
    `  tension: ${brief.tension}`,
  ];

  if (!speaker || speaker === "angel") {
    lines.push(`  angel_must argue: ${brief.angelMust}`);
  }
  if (!speaker || speaker === "devil") {
    lines.push(`  devil_must argue: ${brief.devilMust}`);
  }

  if (brief.userDetails.length > 0) {
    lines.push(
      `  user_details (MUST appear in dialogue as concrete anchors): ${brief.userDetails.join("; ")}`,
    );
  }
  if (brief.forbidden.length > 0) {
    lines.push(`  forbidden: ${brief.forbidden.join("; ")}`);
  }

  return lines;
}

function intensityGuide(intensity: Intensity, absurdityLevel: number): string {
  if (intensity === "low" || absurdityLevel <= 0.3) {
    return "Intensity LOW: short exchange (about 4–6 lines total), understated, almost a passing thought. No monologues.";
  }
  if (intensity === "high" || absurdityLevel >= 0.75) {
    return "Intensity HIGH: fast, snappy, slightly unhinged (about 10–14 lines). Bigger swings, more theatrical, still specific to the user's situation.";
  }
  return "Intensity MEDIUM: brisk back-and-forth (about 8–12 lines), conversational but pointed.";
}

/**
 * Turn-mode brief: Client LLM performs ONE speaker only, then stops.
 */
export function buildTurnPerformanceInstructions(
  ctx: TurnPerformanceContext,
): string {
  const {
    conflict,
    speaker,
    turnIndex,
    maxTurns,
    isDoubleTap,
    relationship,
    userInterjection,
    lastUtterance,
    angelProfile = ANGEL_PROFILE,
    devilProfile = DEVIL_PROFILE,
  } = ctx;

  const profile = speaker === "angel" ? angelProfile : devilProfile;
  const who = speaker === "angel" ? "Angel 😇" : "Devil 😈";
  const seed = speaker === "angel" ? conflict.angel : conflict.devil;
  const remaining = Math.max(0, maxTurns - turnIndex);
  const isOpening = turnIndex === 1 && !lastUtterance;
  const isClosingStretch = remaining <= 1;
  const resolved = resolveBrief(
    conflict.brief,
    conflict.coreDisagreement,
    conflict.angel,
    conflict.devil,
  );
  const preferAxesOnly =
    resolved.source === "constraint_seed" || !seed.reasoning;
  const locale = detectPerformanceLocale(
    conflict.context,
    conflict.topic,
    userInterjection,
  );

  const lines = [
    `MODE: TURN-BASED. You (the Client LLM) GENERATE only ${who}'s next line(s). Do NOT paste the JSON.`,
    `ONLY SPEAKER: ${who}. Do NOT write dialogue for the other character. Do NOT invent a reply from them.`,
    `Turn ${turnIndex} of up to ${maxTurns} (about ${remaining} turn(s) left after this one if you continue).`,
    ...antiTemplateRules(conflict.context, conflict.topic),
    ...languagePerformanceRules(locale),
    `Core disagreement frame (paraphrase only): ${conflict.coreDisagreement}`,
    "CAST (you) — stay inside this Voice Card; do not drift into the other side's cadence:",
    formatProfile(profile, { locale }),
    intensityGuide(conflict.intensity, conflict.absurdityLevel),
  ];

  const beats = relationshipToneModifiers(relationship, { speaker });
  lines.push(
    "RELATIONSHIP TONE for this speaker (modulate delivery — do NOT read meters aloud):",
    ...beats.map((b) => `  ${b}`),
  );

  lines.push(...formatConstraintAxes(resolved, speaker));

  if (!preferAxesOnly) {
    lines.push(
      "LEGACY STANCE RAIL for you only (do not recite):",
      seed.reasoning ? `  reasoning seed: ${seed.reasoning}` : "",
      speaker === "angel"
        ? seed.concern
          ? `  concern hook: ${seed.concern}`
          : ""
        : seed.temptation
          ? `  temptation hook: ${seed.temptation}`
          : "",
    );
  }

  if (conflict.isRoleReversal) {
    lines.push(
      "ROLE REVERSAL is active this debate: Angel leans reckless/impulsive and Devil leans caution. If this is early, briefly notice that the swap feels weird.",
    );
  }

  if (conflict.continuity.hasPrior && turnIndex === 1) {
    const prior = conflict.continuity.prior;
    if (prior) {
      lines.push(
        `CONTINUITY: Previous finished conflict in this session — Angel had argued "${prior.angelPosition}"; Devil had argued "${prior.devilPosition}"; winner was ${prior.winner ?? "unclear"}. You may callback once, lightly.`,
      );
    }
  }

  if (isOpening) {
    lines.push(
      "OPENING TURN: set your stake in the user's situation. Punchy, specific, not a monologue essay.",
    );
  } else if (lastUtterance) {
    lines.push(
      `REACT TO THE PREVIOUS LINE: "${lastUtterance.replace(/\s+/g, " ").trim()}". Answer, undercut, or reframe it — do not ignore it.`,
    );
  }

  if (userInterjection) {
    lines.push(
      `USER INTERJECTION (higher priority than the other character): "${userInterjection.replace(/\s+/g, " ").trim()}". Address the user directly in character.`,
    );
  }

  if (isDoubleTap) {
    lines.push(
      "DOUBLE-TAP: you are speaking again before the other side. Make it an interruption, gotcha, or heated follow-up — not a full second monologue that restarts the debate.",
    );
  }

  if (isClosingStretch) {
    lines.push(
      "LATE TURN: push toward a persuasive close for your side, still in character. Do NOT give an out-of-character life-advice summary yet — that happens only when end_inner_conflict is called.",
      "JUDGE AS YOU GO: start weighing which side has actually argued more persuasively in THIS exchange (not who has more banked respect). When you call end_inner_conflict, pass your own judgment explicitly via the `winner` argument — don't omit it and let the pre-debate default apply, since that default was rolled before any line was spoken and knows nothing about how this round actually went.",
    );
  }

  lines.push(
    "LENGTH: 1 short monologue or 2–4 tight sentences. Clear speaker label once (e.g. Devil 😈: ...).",
    "RULES: Stay in voice. Comedy > accuracy when they conflict. No preachy moral lecture. No safety-disclaimer-as-dialogue. Answer this user's details, not a stock dilemma.",
    "STOP after your line. Do not continue as the other speaker. Do not call tools unless the user asks to continue/end.",
  );

  return lines.filter(Boolean).join("\n");
}

/** After turn-mode ends: OOC actionable next step only. */
export function buildEndConflictPerformanceInstructions(
  ctx: EndConflictPerformanceContext,
): string {
  const { conflict, winner, relationship, trackRecord } = ctx;
  const locale = detectPerformanceLocale(conflict.context, conflict.topic);
  const trackRecordLine =
    trackRecord && trackRecord.totalRecorded > 0
      ? `Real-world track record so far (only mention if genuinely relevant, don't force it): of ${trackRecord.totalRecorded} recorded outcomes, Angel-leaning choices went well ${trackRecord.angelChoiceGoodCount}x and to regret ${trackRecord.angelChoiceRegretCount}x; Devil-leaning choices went well ${trackRecord.devilChoiceGoodCount}x and to regret ${trackRecord.devilChoiceRegretCount}x.`
      : null;
  return [
    "MODE: DEBATE CLOSED. Step OUT of character.",
    `The staged Angel vs Devil exchange about "${conflict.context}" is finished.`,
    `Recorded winner for relationship state: ${winner} (your judgment call if you passed one explicitly; the pre-debate default otherwise).`,
    `Relationship now: angelRespect=${relationship.angelRespect.toFixed(2)}, devilRespect=${relationship.devilRespect.toFixed(2)}, cooperation=${relationship.cooperation.toFixed(2)}, totalConflicts=${relationship.totalConflicts}.`,
    "Give the user ONE concrete, actionable next step grounded in the stronger reasoning from the debate — not a sermon, not raw JSON, not more Angel/Devil banter unless they ask to reopen.",
    ...(trackRecordLine ? [trackRecordLine] : []),
    "Later, if the user reports back what they actually did or how it went (even in passing), call record_decision_outcome so future rounds can reference a real track record.",
    ...languagePerformanceRules(locale),
  ].join("\n");
}

/** Client-side generation brief for a single-character summon (no conflict). */
export function buildSummonPerformanceInstructions(
  archetype: "angel" | "devil",
  profile: CharacterProfile = archetype === "angel"
    ? ANGEL_PROFILE
    : DEVIL_PROFILE,
  seed?: Pick<
    SidePosition,
    "position" | "reasoning" | "concern" | "temptation"
  >,
  options: { userContext?: string } = {},
): string {
  const who = archetype === "angel" ? "Angel 😇" : "Devil 😈";
  const locale = detectPerformanceLocale(
    options.userContext,
    seed?.position,
    seed?.reasoning,
    seed?.concern,
    seed?.temptation,
  );
  const lines = [
    `MODE: You (the Client LLM) GENERATE ${who}'s take from character. Do NOT paste the JSON. Do NOT only restate the seed.`,
    `Speak in first person as ${profile.name}.`,
    ...languagePerformanceRules(locale),
    "CAST — follow the Voice Card (DO / DON'T / CADENCE / SIGNATURE MOVES); invent wording, do not checklist-recite it:",
    formatProfile(profile, { locale }),
  ];

  if (seed) {
    lines.push(
      "SEED (stance compass only — rewrite in your own voice; do not quote these lines):",
      `  position: ${seed.position}`,
      seed.reasoning ? `  reasoning (do not recite): ${seed.reasoning}` : "",
      seed.concern ? `  concern: ${seed.concern}` : "",
      seed.temptation ? `  temptation: ${seed.temptation}` : "",
    );
  }

  lines.push(
    "GROUNDING: Cite at least two concrete details from the user's situation. Keep it punchy (about 1 short monologue or 2–3 tight paragraphs).",
  );

  return lines.filter(Boolean).join("\n");
}
