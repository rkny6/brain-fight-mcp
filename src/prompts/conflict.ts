export interface TopicTemplate {
  keywords: string[];
  angel: { position: string; reasoning: string; concern: string };
  devil: { position: string; reasoning: string; temptation: string };
  coreDisagreement: string;
}

/**
 * Keyword-matched topic templates. The conflictEngine scans `context`
 * (and `topic`, if provided) for these keywords, case-insensitively,
 * and uses the first match. Falls back to the generic Safety vs
 * Freedom template if nothing matches.
 */
export const TOPIC_TEMPLATES: TopicTemplate[] = [
  {
    keywords: ["quit job", "quit my job", "resign", "quitting"],
    angel: {
      position: "Don't quit yet — line something up first.",
      reasoning:
        "A paycheck is not a personality flaw. Leaving with a plan protects the parts of your life that depend on stability: rent, sleep, sanity.",
      concern: "That freedom without a cushion turns into panic within a month.",
    },
    devil: {
      position: "Quit. Today. Send the email.",
      reasoning:
        "You've rehearsed this speech in the shower forty times. The job isn't getting better. Every day you stay is a day you're not looking for the thing that will.",
      temptation: "The specific, delicious silence of an empty inbox.",
    },
    coreDisagreement: "Whether security or momentum matters more right now.",
  },
  {
    keywords: ["buy", "purchase", "should i get", "spend money on"],
    angel: {
      position: "Sleep on it. Check the budget first.",
      reasoning:
        "Impulse purchases have a way of feeling essential at 11pm and ridiculous by Tuesday. A 24-hour rule costs nothing and saves a lot.",
      concern: "Buyer's remorse compounding with actual financial strain.",
    },
    devil: {
      position: "Buy it. You've thought about this enough already.",
      reasoning:
        "You didn't earn money to stare at it in a spreadsheet. This isn't reckless, it's a reward, and you've been putting off rewards for months.",
      temptation: "That little dopamine hit of opening the box.",
    },
    coreDisagreement: "Whether restraint or reward is the more honest form of self-respect.",
  },
  {
    keywords: ["apologize", "apology", "say sorry", "text them"],
    angel: {
      position: "Reach out and apologize, even if it's uncomfortable.",
      reasoning:
        "Being right and being kind aren't always the same thing. Repair matters more than being technically correct, and silence gets heavier the longer it sits.",
      concern: "That pride quietly costs you a relationship you actually value.",
    },
    devil: {
      position: "Don't apologize first. Let them come to you.",
      reasoning:
        "You apologize for everything. This time, sit in the discomfort and see what happens when you don't immediately smooth it over.",
      temptation: "The strange, satisfying dignity of not folding first.",
    },
    coreDisagreement: "Whether repair or self-respect should come first.",
  },
  {
    keywords: ["ex", "text my ex", "message my ex", "get back together"],
    angel: {
      position: "Don't text them. Let it stay closed.",
      reasoning:
        "You already did the hard work of moving on. Reopening the door because tonight feels lonely is going to cost future-you a setback tonight-you won't be around to handle.",
      concern: "Relapsing into a dynamic you specifically worked to leave.",
    },
    devil: {
      position: "Text them. What's the actual harm in one message?",
      reasoning:
        "You're curious, and curiosity isn't a crime. One message isn't a proposal. Sometimes the story isn't over just because it's supposed to be.",
      temptation: "Finding out if they still think about you too.",
    },
    coreDisagreement: "Whether closure or curiosity should win tonight.",
  },
  {
    keywords: ["diet", "cheat meal", "skip the gym", "workout"],
    angel: {
      position: "Stick to the plan you set for yourself.",
      reasoning:
        "The version of you who made this plan had clearer judgment than the version of you negotiating with it right now, at the moment of temptation.",
      concern: "That 'just this once' quietly becomes the new baseline.",
    },
    devil: {
      position: "Skip it tonight. One day doesn't undo anything.",
      reasoning:
        "You're not a machine, and treating a single choice like a moral failure is exactly the mindset that makes people quit altogether. Flexibility keeps people in the game longer than rigidity does.",
      temptation: "Enjoying something without narrating it as a failure.",
    },
    coreDisagreement: "Whether discipline or flexibility better serves the long run.",
  },
];

export const GENERIC_TOPIC: TopicTemplate = {
  keywords: [],
  angel: {
    position: "Choose the safer, more considered path.",
    reasoning:
      "Slowing down costs a little time. Rushing can cost a lot more.",
    concern: "That speed is being mistaken for confidence.",
  },
  devil: {
    position: "Choose freedom. Act now, ask forgiveness later.",
    reasoning:
      "Caution feels responsible, but it's often just fear with better PR. The moment won't wait for a committee meeting.",
    temptation: "Finding out what happens when you don't hesitate.",
  },
  coreDisagreement: "Whether safety or freedom should win this round.",
};

/** Finds the first topic template whose keyword appears in the given text. */
export function findTopicTemplate(text: string): TopicTemplate {
  const haystack = text.toLowerCase();
  for (const template of TOPIC_TEMPLATES) {
    if (template.keywords.some((kw) => haystack.includes(kw.toLowerCase()))) {
      return template;
    }
  }
  return GENERIC_TOPIC;
}
