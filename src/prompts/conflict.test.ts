import { describe, expect, it } from "vitest";
import {
  extractUserDetails,
  findTopicTemplate,
  findTopicTemplateDetailed,
  scoreTopicTemplate,
  TOPIC_TEMPLATES,
  tokenizeSituation,
} from "./conflict.js";

describe("tokenizeSituation / extractUserDetails", () => {
  it("tokenizes english content words and drops stopwords", () => {
    const tokens = tokenizeSituation("Should I quit my job tomorrow?");
    expect(tokens).toContain("quit");
    expect(tokens).toContain("job");
    // Relative time words are stopwords for overlap scoring; extractUserDetails
    // still pulls them via dedicated time regex.
    expect(tokens).not.toContain("tomorrow");
    expect(tokens).not.toContain("should");
    expect(tokens).not.toContain("my");
  });

  it("extracts money, time, and chinese life nouns", () => {
    const en = extractUserDetails(
      'Buy the $899 headphones "noise cancel" tonight before rent hits',
    );
    expect(en.some((d) => /899/.test(d))).toBe(true);
    expect(en.some((d) => /tonight/i.test(d))).toBe(true);
    expect(en.some((d) => /noise cancel/i.test(d))).toBe(true);

    const zh = extractUserDetails("我明天要不要裸辞？下个月房租还没着落。");
    expect(zh.some((d) => /明天|房租|裸辞|下个月/.test(d))).toBe(true);
  });
});

describe("findTopicTemplateDetailed", () => {
  it("keyword-matches quit-job style contexts", () => {
    const found = findTopicTemplateDetailed(
      "I'm thinking about whether I should quit my job tomorrow",
    );
    expect(found.match).toBe("keyword");
    expect(found.template.coreDisagreement).toBe(
      "Whether security or momentum matters more right now.",
    );
  });

  it("returns generic for pure noise", () => {
    const found = findTopicTemplateDetailed(
      "Something totally unrelated to any known keyword, xyz123",
    );
    expect(found.match).toBe("generic");
    expect(found.template.coreDisagreement).toBe(
      "Whether safety or freedom should win this round.",
    );
  });

  it("prefers chinese templates for chinese text", () => {
    const t = findTopicTemplate("我明天要不要裸辞？");
    expect(t.lang).toBe("zh");
    expect(t.coreDisagreement).toContain("安全感");
  });

  it("scores longer keyword phrases higher than short ones", () => {
    const quit = TOPIC_TEMPLATES.find((t) =>
      t.keywords.includes("quit my job"),
    )!;
    const short = scoreTopicTemplate("I might resign someday", quit);
    const long = scoreTopicTemplate("I should quit my job tomorrow", quit);
    expect(long).toBeGreaterThan(short);
  });
});
