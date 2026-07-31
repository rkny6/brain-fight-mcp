export interface TopicTemplate {
  keywords: string[];
  lang?: "en" | "zh";
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
    keywords: [
      "quit job",
      "quit my job",
      "resign",
      "quitting",
      "leave my job",
      "hand in my notice",
      "two weeks notice",
      "walk out",
    ],
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
    keywords: [
      "buy",
      "purchase",
      "should i get",
      "spend money on",
      "add to cart",
      "order it",
      "splurge",
    ],
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
    keywords: ["apologize", "apology", "say sorry", "make amends", "own up"],
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
    keywords: [
      "ex",
      "text my ex",
      "message my ex",
      "get back together",
      "call my ex",
      "ex-boyfriend",
      "ex-girlfriend",
      "ex boyfriend",
      "ex girlfriend",
    ],
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
    keywords: ["diet", "cheat meal", "skip the gym", "workout", "gym", "calories"],
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
  {
    keywords: ["breakup", "break up", "break off", "end the relationship", "leave them"],
    angel: {
      position: "Think it through before you say it out loud.",
      reasoning:
        "Words you can't take back. Make sure you're not mistaking exhaustion for the end of love.",
      concern: "A temporary low gets locked in as a permanent decision.",
    },
    devil: {
      position: "Stop dragging it. You've already decided.",
      reasoning:
        "\"Think more\" is sometimes just a polite way to keep enduring. You already know the answer.",
      temptation: "The relief of not carrying the question anymore.",
    },
    coreDisagreement: "Whether to wait and reassess, or end it now.",
  },
  {
    keywords: [
      "career change",
      "switch jobs",
      "switch job",
      "change careers",
      "new industry",
      "pivot careers",
    ],
    angel: {
      position: "Probe first — don't go all-in yet.",
      reasoning:
        "Passion and a career are different animals. Side projects and skill-building beat a blind leap.",
      concern: "Turning something you love into pure pressure.",
    },
    devil: {
      position: "You won't know until you try.",
      reasoning:
        "You've already invested years on this path. If it isn't the one, every extra month is doubling down on the wrong bet.",
      temptation: "The jolt of starting over on purpose.",
    },
    coreDisagreement: "Whether a careful transition or a clean break is smarter.",
  },
  {
    keywords: ["lend money", "borrow", "loan them", "spot them", "wire them money"],
    angel: {
      position: "Price the worst case before you say yes.",
      reasoning:
        "Money and friendship mix badly. Only lend what you can lose — including the friendship.",
      concern: "Losing both the cash and the person.",
    },
    devil: {
      position: "Help them. Friends beat money.",
      reasoning:
        "Real friends don't leave you hanging, and your hesitation already says you don't trust the bond.",
      temptation: "The warm hit of being needed.",
    },
    coreDisagreement: "Whether money or the relationship is the risk you can't take.",
  },
  {
    keywords: ["confess", "tell them how i feel", "tell them i like", "ask them out", "declare"],
    angel: {
      position: "Wait for a real signal first.",
      reasoning:
        "One-sided courage can just pressure them. Don't dress up a hostage situation as honesty.",
      concern: "Saying it ends even the friendship.",
    },
    devil: {
      position: "Say it. Silence is the longer regret.",
      reasoning:
        "Quiet doesn't protect you — it just makes you chew on \"what if\". A clear no beats no answer.",
      temptation: "The exhale of finally putting it on the table.",
    },
    coreDisagreement: "Whether protecting the status quo or chasing the possibility is braver.",
  },
  {
    keywords: ["marry", "propose", "marriage", "engagement", "get engaged"],
    angel: {
      position: "Live more of the hard parts together first.",
      reasoning:
        "Marriage is a start, not a finish line. Make sure you've carried weight together, not only good times.",
      concern: "Mistaking romance for the skill of building a life.",
    },
    devil: {
      position: "Do it now. You already know.",
      reasoning:
        "There is no perfect timing. Waiting to \"be ready\" is waiting for a signal that never arrives.",
      temptation: "The clean certainty of \"this is the person\".",
    },
    coreDisagreement: "Whether more proof or a decision now is the responsible move.",
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

export const GENERIC_TOPIC_ZH: TopicTemplate = {
  keywords: [],
  lang: "zh",
  angel: {
    position: "选更稳妥、更经过深思熟虑的路。",
    reasoning: "慢一点只是多花点时间，冲动行事可能代价更大。",
    concern: "别把速度错当成信心。",
  },
  devil: {
    position: "选自由。先行动，再道歉。",
    reasoning: "谨慎听起来很负责，但往往只是恐惧穿了件西装。这一刻不会等你开完部门会。",
    temptation: "看看不犹豫会发生什么。",
  },
  coreDisagreement: "这一轮，安全该赢还是自由该赢。",
};

/** Chinese topic templates */
export const TOPIC_TEMPLATES_ZH: TopicTemplate[] = [
  {
    keywords: ["裸辞", "辞职", "quit", "resign", "quitting", "quit job"],
    lang: "zh",
    angel: {
      position: "别急着辞，先找好下家。",
      reasoning: "工资不是人格污点。有规划地离开，才能保护那些依赖稳定性的部分：房租、睡眠、理智。",
      concern: "没有缓冲的自由，一个月内就会变成恐慌。",
    },
    devil: {
      position: "辞。今天就发邮件。",
      reasoning: "这段话你在脑子里排练了四十遍了。这份工作不会变好。你多待一天，就少找一天真正属于你的东西。",
      temptation: "那种收件箱清空的、美妙的安静。",
    },
    coreDisagreement: "现在更重要的是安全感还是行动力。",
  },
  {
    keywords: ["买", "花钱", "剁手", "buy", "purchase", "spend money"],
    lang: "zh",
    angel: {
      position: "先睡一晚，查查预算。",
      reasoning: "冲动消费的东西，晚上11点觉得必不可少，周二就觉得荒唐。24小时冷静期不花钱，但能省很多。",
      concern: "买家悔恨叠加真实的财务压力。",
    },
    devil: {
      position: "买。你想得够久了。",
      reasoning: "你赚钱不是为了让它在表格里盯着你。这不是冲动，是奖励，你已经推迟奖励好几个月了。",
      temptation: "拆包装时那一小撮多巴胺。",
    },
    coreDisagreement: "克制和奖励，哪个才是更诚实的自我尊重。",
  },
  {
    keywords: ["道歉", "对不起", "apologize", "apology", "say sorry", "text them"],
    lang: "zh",
    angel: {
      position: "主动联系道歉，哪怕不舒服。",
      reasoning: "对和善不总是同一件事。修复比技术上正确更重要，沉默越久越沉重。",
      concern: "骄傲正在悄悄消耗你真正在意的关系。",
    },
    devil: {
      position: "别先道歉。让他们来找你。",
      reasoning: "你什么都道歉。这次，坐在不舒服里看看会发生什么，别急着去抚平。",
      temptation: "不先低头时那种奇怪的、令人满足的尊严。",
    },
    coreDisagreement: "修复和自我尊重，哪个该先来。",
  },
  {
    keywords: ["前任", "ex", "复合", "text my ex", "message my ex", "get back together"],
    lang: "zh",
    angel: {
      position: "别联系。让它留在过去。",
      reasoning: "你已经完成了放下的艰难工作。因为今晚寂寞重新开门，会让未来的你承受你今晚不用面对的挫折。",
      concern: "复发到你特意离开的那种关系模式里。",
    },
    devil: {
      position: "联系啊。一条消息能有什么实际伤害？",
      reasoning: '你好奇，好奇不是罪。一条消息不是求婚。有时候故事没结束，只是它"应该"结束了。',
      temptation: "发现他们是否也在想你。",
    },
    coreDisagreement: "今晚，closure 还是好奇心该赢。",
  },
  {
    keywords: ["减肥", "健身", "吃", "diet", "cheat meal", "skip the gym", "workout"],
    lang: "zh",
    angel: {
      position: "坚持你给自己定的计划。",
      reasoning: "制定计划时的你比现在正在讨价还价的你判断更清晰。",
      concern: '"就这一次"会悄悄成为新的基准线。',
    },
    devil: {
      position: "今天跳过。一天不会毁掉什么。",
      reasoning: "你不是机器，把单次选择当成道德失败，恰恰是让人彻底放弃的心态。灵活性比死板更能让人留在游戏里。",
      temptation: "享受某件事而不把它叙述为失败。",
    },
    coreDisagreement: "死板和灵活，哪个更服务于长期。",
  },
  {
    keywords: ["分手", "breakup", "break up", "分开"],
    lang: "zh",
    angel: {
      position: "想清楚再开口。",
      reasoning: '说出去的话收不回来。确定你不是在把"累"误认为"不爱了"。',
      concern: "一时的疲惫被误读为永久的决定。",
    },
    devil: {
      position: "别拖了。你已经决定了。",
      reasoning: '"再想想"有时候只是"再忍忍"的体面说法。你心里早就有答案了。',
      temptation: "那种终于不再纠结的轻松。",
    },
    coreDisagreement: "该再想想，还是该了断了。",
  },
  {
    keywords: ["转行", "跳槽", "换工作", "career change", "switch job"],
    lang: "zh",
    angel: {
      position: "先试探，别全押。",
      reasoning: "热情和职业是两回事。兼职试试、先学技能，比一步跨过去安全得多。",
      concern: "把爱好变成压力来源。",
    },
    devil: {
      position: "不试怎么知道。",
      reasoning: '你已经在现在的路上走了这么久，如果它不是"那个"，你只是在继续投资一个错误。',
      temptation: "重新开始的那种刺激。",
    },
    coreDisagreement: "稳妥过渡和孤注一掷，哪个更聪明。",
  },
  {
    keywords: ["借钱", "借钱给", "lend money", "borrow"],
    lang: "zh",
    angel: {
      position: "想好最坏的情况。",
      reasoning: "钱和朋友沾边，往往两样都伤。确定你丢得起这笔钱——包括丢朋友。",
      concern: "钱收不回来，人也走了。",
    },
    devil: {
      position: "帮一把。朋友比钱重要。",
      reasoning: "真朋友不会让你吃亏，而你现在的犹豫，已经在暗示你对这段关系没信心了。",
      temptation: "被需要的那种满足感。",
    },
    coreDisagreement: "钱和朋友，哪个更不能冒险。",
  },
  {
    keywords: ["表白", "告白", "confess", "tell them", "喜欢"],
    lang: "zh",
    angel: {
      position: "先确认对方有信号。",
      reasoning: '单方面的勇气有时候只是给对方施压。别把"诚实"变成"绑架"。',
      concern: "说出口后连朋友都做不成。",
    },
    devil: {
      position: "说。不说你会后悔一辈子。",
      reasoning: '沉默不会保护你，只会让你反复咀嚼"如果当初"。最差的结果也比没有结果好。',
      temptation: "那种如释重负的坦白。",
    },
    coreDisagreement: "保护现状和追求可能，哪个更勇敢。",
  },
  {
    keywords: ["结婚", "求婚", "marry", "propose", "婚姻"],
    lang: "zh",
    angel: {
      position: "再相处看看。",
      reasoning: "婚姻不是终点，是起点。确保你们已经一起扛过事，而不只是共享过快乐。",
      concern: "把浪漫当成了共同生活的能力。",
    },
    devil: {
      position: "就现在。你已经知道了。",
      reasoning: '没有完美的时机。你等"准备好"，其实是在等一个永远不会来的信号。',
      temptation: '那种"就是这个人"的确信。',
    },
    coreDisagreement: "再确认一下和现在就决定，哪个更负责。",
  },
];

/** True if the text contains Chinese characters (rough heuristic). */
export function isChineseText(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

const EN_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "then",
  "else",
  "when",
  "while",
  "for",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "from",
  "with",
  "about",
  "into",
  "over",
  "after",
  "before",
  "between",
  "without",
  "is",
  "am",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "do",
  "does",
  "did",
  "doing",
  "have",
  "has",
  "had",
  "having",
  "i",
  "me",
  "my",
  "we",
  "our",
  "you",
  "your",
  "he",
  "she",
  "it",
  "they",
  "them",
  "their",
  "this",
  "that",
  "these",
  "those",
  "what",
  "which",
  "who",
  "whom",
  "how",
  "why",
  "should",
  "would",
  "could",
  "can",
  "will",
  "just",
  "not",
  "no",
  "yes",
  "so",
  "too",
  "very",
  "really",
  "maybe",
  "like",
  "get",
  "got",
  "make",
  "made",
  "want",
  "need",
  "think",
  "know",
  "feel",
  "more",
  "most",
  "some",
  "any",
  "all",
  "than",
  "as",
  "up",
  "out",
  "off",
  "again",
  "still",
  "also",
  "only",
  "even",
  "much",
  "many",
  "such",
  "own",
  "same",
  "other",
  "another",
  "because",
  "though",
  "although",
  "however",
  "there",
  "here",
  "now",
  "today",
  "tonight",
  "tomorrow",
  "something",
  "anything",
  "everything",
  "nothing",
  "someone",
  "anyone",
  "everyone",
]);

const ZH_STOPWORDS = new Set([
  "的",
  "了",
  "在",
  "是",
  "我",
  "有",
  "和",
  "就",
  "不",
  "人",
  "都",
  "一",
  "一个",
  "上",
  "也",
  "很",
  "到",
  "说",
  "要",
  "去",
  "你",
  "会",
  "着",
  "没有",
  "看",
  "好",
  "自己",
  "这",
  "那",
  "吗",
  "吧",
  "呢",
  "啊",
  "呀",
  "嘛",
  "什么",
  "怎么",
  "怎样",
  "为什么",
  "因为",
  "所以",
  "如果",
  "还是",
  "或者",
  "但是",
  "然后",
  "可以",
  "应该",
  "一下",
  "这个",
  "那个",
  "现在",
  "今天",
  "明天",
  "今晚",
  "真的",
  "比较",
  "有点",
  "一下",
  "是否",
  "要不要",
  "该不该",
]);

/**
 * Tokenize situation text for zero-dependency overlap scoring.
 * English: word tokens. Chinese: CJK unigrams + latin words.
 */
export function tokenizeSituation(text: string): string[] {
  const lower = text.toLowerCase();
  const out: string[] = [];
  const wordRe = /[a-z0-9][a-z0-9'-]{1,}|[\u4e00-\u9fff]/g;
  let m: RegExpExecArray | null;
  while ((m = wordRe.exec(lower)) !== null) {
    const raw = m[0];
    if (/[\u4e00-\u9fff]/.test(raw)) {
      for (const ch of raw) {
        if (!ZH_STOPWORDS.has(ch)) out.push(ch);
      }
      // Keep short multi-char Chinese chunks when present (2–4).
      if (raw.length >= 2 && raw.length <= 4 && !ZH_STOPWORDS.has(raw)) {
        out.push(raw);
      }
    } else if (!EN_STOPWORDS.has(raw) && raw.length > 1) {
      out.push(raw);
    }
  }
  return out;
}

/** Jaccard-ish overlap in [0, 1] between two token bags. */
export function tokenOverlapScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const t of setA) {
    if (setB.has(t)) inter += 1;
  }
  if (inter === 0) return 0;
  const union = setA.size + setB.size - inter;
  return inter / union;
}

/**
 * Pull concrete anchors from free-form context for CONSTRAINT AXES user_details.
 * Deterministic heuristics only — no LLM.
 */
export function extractUserDetails(text: string, limit = 8): string[] {
  const details: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    const cleaned = raw.replace(/\s+/g, " ").trim();
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    // Skip ultra-generic scraps.
    if (cleaned.length < 2) return;
    if (/^(should i|i should|help me|what if|要不要|该不该|怎么办)$/i.test(cleaned)) {
      return;
    }
    seen.add(key);
    details.push(cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned);
  };

  // Money / amounts
  const moneyRe =
    /(?:\$|¥|€|£)\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|m|万|亿))?|\d[\d,]*(?:\.\d+)?\s?(?:dollars?|usd|rmb|cny|yuan|bucks|万|亿|块钱|元)/gi;
  for (const m of text.matchAll(moneyRe)) push(m[0]);

  // Dates / relative time
  const timeRe =
    /\b(?:today|tonight|tomorrow|this week|next week|this month|next month|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{1,2}-\d{1,2})\b|今天|今晚|明天|后天|这周|下周|这个月|下个月|月底|周一|周二|周三|周四|周五|周六|周日|\d{1,2}月\d{1,2}日?/gi;
  for (const m of text.matchAll(timeRe)) push(m[0]);

  // Deadlines / clocks
  const clockRe = /\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b|\d{1,2}点(?:半|\d{1,2}分)?/gi;
  for (const m of text.matchAll(clockRe)) push(m[0]);

  // Quoted fragments the user emphasized
  const quoteRe = /[“"]([^”"]{2,60})[”"]/g;
  for (const m of text.matchAll(quoteRe)) push(m[1]!);

  // Useful multi-word English noun-ish phrases (2–4 tokens, not pure stopwords)
  const enPhraseRe =
    /\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}|[a-z]+(?:\s+[a-z]+){1,3}\s+(?:job|offer|rent|lease|visa|interview|deadline|loan|mortgage|boss|manager|coworker|girlfriend|boyfriend|husband|wife|parents?|kids?|school|exam|project|startup|contract|salary|bonus|gym|diet|wedding|proposal))\b/g;
  for (const m of text.matchAll(enPhraseRe)) push(m[0]);

  // Chinese concrete chunks: common life nouns + nearby modifiers (simple window)
  const zhNounRe =
    /(?:下个月?|这个月|明天|今天)?(?:房租|房贷|工资|offer|口头offer|书面offer|医保|签证|合同|站会|裸辞|辞职|跳槽|转行|前任|表白|求婚|结婚|借钱|健身|减肥|考试|面试|老板|同事|父母|孩子|对象|男朋友|女朋友|老公|老婆)/gi;
  for (const m of text.matchAll(zhNounRe)) push(m[0]);

  // Fallback: top content tokens (length-biased) so sparse contexts still ground
  if (details.length < 2) {
    const tokens = tokenizeSituation(text)
      .filter((t) => t.length >= 2)
      .sort((a, b) => b.length - a.length || a.localeCompare(b));
    for (const t of tokens) {
      if (details.length >= limit) break;
      push(t);
    }
  }

  return details.slice(0, limit);
}

/** Score how well a template fits free-form situation text. Higher is better. */
export function scoreTopicTemplate(text: string, template: TopicTemplate): number {
  const haystack = text.toLowerCase();
  let score = 0;

  // Keyword hits: longer phrases win harder (prefer "quit my job" over bare "quit").
  for (const kw of template.keywords) {
    const needle = kw.toLowerCase();
    if (!needle) continue;
    if (haystack.includes(needle)) {
      score += 10 + Math.min(12, needle.length);
    }
  }

  // Soft overlap against template rails (helps near-misses without exact keywords).
  const situationTokens = tokenizeSituation(text);
  const templateBlob = [
    template.coreDisagreement,
    template.angel.position,
    template.devil.position,
    ...template.keywords,
  ].join(" ");
  const overlap = tokenOverlapScore(situationTokens, tokenizeSituation(templateBlob));
  score += overlap * 8;

  return score;
}

export interface FindTopicTemplateResult {
  template: TopicTemplate;
  /** How the template was chosen. */
  match: "keyword" | "overlap" | "generic";
  /** Best raw score among candidates (0 for pure generic with no signal). */
  score: number;
}

/**
 * Pick a topic template for free-form context.
 * 1) Best keyword/overlap score among language-matched templates
 * 2) If score is too weak → language-matched GENERIC (Safety vs Freedom)
 */
export function findTopicTemplateDetailed(text: string): FindTopicTemplateResult {
  const zh = isChineseText(text);
  const pool = zh ? TOPIC_TEMPLATES_ZH : TOPIC_TEMPLATES;
  const generic = zh ? GENERIC_TOPIC_ZH : GENERIC_TOPIC;

  let best: TopicTemplate | null = null;
  let bestScore = 0;

  for (const template of pool) {
    const score = scoreTopicTemplate(text, template);
    if (score > bestScore) {
      bestScore = score;
      best = template;
    }
  }

  // Strong keyword-ish hit
  if (best && bestScore >= 10) {
    return { template: best, match: "keyword", score: bestScore };
  }

  // Soft overlap near-miss (no exact keyword, but tokens lean toward a topic)
  if (best && bestScore >= 1.5) {
    return { template: best, match: "overlap", score: bestScore };
  }

  return { template: generic, match: "generic", score: bestScore };
}

/** Finds the best topic template for the given text (keyword → overlap → generic). */
export function findTopicTemplate(text: string): TopicTemplate {
  return findTopicTemplateDetailed(text).template;
}
