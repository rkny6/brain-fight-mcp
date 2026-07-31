import type {
  Intensity,
  RelationshipState,
  Speaker,
  TopicBias,
  Winner,
} from "../types/index.js";

/** low=2, medium=4, high=6 spoken turns (one speaker each). */
export const MAX_TURNS_BY_INTENSITY: Record<Intensity, number> = {
  low: 2,
  medium: 4,
  high: 6,
};

/** Rare same-speaker double-tap chance when relationship is spicy. */
export const DOUBLE_TAP_CHANCE = 0.12;

const CAUTION_KEYWORDS = [
  "apologiz",
  "sorry",
  "health",
  "risk",
  "safe",
  "budget",
  "save",
  "debt",
  "道歉",
  "后悔",
  "风险",
  "安全",
  "健康",
  "预算",
  "存钱",
];

const IMPULSE_KEYWORDS = [
  "quit",
  "resign",
  "buy",
  "purchase",
  "text my ex",
  "message my ex",
  "impulsive",
  "tonight",
  "right now",
  "裸辞",
  "辞职",
  "买",
  "下单",
  "冲动",
  "现在就",
  "前男友",
  "前女友",
];

export function oppositeSpeaker(speaker: Speaker): Speaker {
  return speaker === "angel" ? "devil" : "angel";
}

export function maxTurnsForIntensity(intensity: Intensity): number {
  return MAX_TURNS_BY_INTENSITY[intensity];
}

/**
 * Lightweight keyword bias for first-speaker heuristics only.
 * Does not replace topic templates.
 */
export function inferTopicBias(text: string): TopicBias {
  const hay = text.toLowerCase();
  const cautionHit = CAUTION_KEYWORDS.some((k) => hay.includes(k));
  const impulseHit = IMPULSE_KEYWORDS.some((k) => hay.includes(k));
  if (cautionHit && !impulseHit) return "caution";
  if (impulseHit && !cautionHit) return "impulse";
  return "neutral";
}

export interface PickFirstSpeakerParams {
  userChoice?: Speaker;
  relationship: RelationshipState;
  /** Winner of the previous finished conflict in this session, if any. */
  priorWinner?: Winner;
  topicBias?: TopicBias;
}

/**
 * First speaker priority:
 * 1) explicit userChoice
 * 2) opposite of priorWinner (loser opens / wants rematch)
 * 3) high devilAnnoyance → devil grabs the mic
 * 4) high angelRespect + low cooperation → angel sets terms
 * 5) topic bias
 * 6) default devil (temptation first, then brake)
 */
export function pickFirstSpeaker({
  userChoice,
  relationship,
  priorWinner = null,
  topicBias = "neutral",
}: PickFirstSpeakerParams): Speaker {
  if (userChoice) {
    return userChoice;
  }

  if (priorWinner === "angel") {
    return "devil";
  }
  if (priorWinner === "devil") {
    return "angel";
  }

  if (relationship.devilAnnoyance >= 0.8) {
    return "devil";
  }
  if (relationship.angelRespect >= 0.7 && relationship.cooperation < 0.4) {
    return "angel";
  }

  if (topicBias === "caution") {
    return "angel";
  }
  if (topicBias === "impulse") {
    return "devil";
  }

  return "devil";
}

export interface PickNextSpeakerParams {
  lastSpeaker: Speaker;
  forceSpeaker?: Speaker;
  relationship: RelationshipState;
  /** Injected for tests; defaults to Math.random. */
  random?: () => number;
}

/**
 * Mid-debate speaker:
 * - forceSpeaker always wins (user point-out)
 * - else alternate, with rare double-tap when relationship is tense
 */
export function pickNextSpeaker({
  lastSpeaker,
  forceSpeaker,
  relationship,
  random = Math.random,
}: PickNextSpeakerParams): { speaker: Speaker; isDoubleTap: boolean } {
  if (forceSpeaker) {
    return { speaker: forceSpeaker, isDoubleTap: forceSpeaker === lastSpeaker };
  }

  const tense =
    relationship.devilAnnoyance >= 0.8 ||
    relationship.angelAnnoyance >= 0.8 ||
    relationship.cooperation <= 0.25;

  if (tense && random() < DOUBLE_TAP_CHANCE) {
    return { speaker: lastSpeaker, isDoubleTap: true };
  }

  return { speaker: oppositeSpeaker(lastSpeaker), isDoubleTap: false };
}

export function turnsRemaining(turnIndex: number, maxTurns: number): number {
  return Math.max(0, maxTurns - turnIndex);
}
