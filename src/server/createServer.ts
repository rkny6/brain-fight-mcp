import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerSummonAngelTool } from "../mcp/tools/summonAngel.js";
import { registerSummonDevilTool } from "../mcp/tools/summonDevil.js";
import { registerStartDebateTool } from "../mcp/tools/startConflict.js";
import { registerGetRelationshipTool } from "../mcp/tools/getRelationship.js";
import { registerResetRelationshipTool } from "../mcp/tools/resetRelationship.js";
import { registerClearDatabaseTool } from "../mcp/tools/clearDatabase.js";
import { registerContinueConflictTurnTool } from "../mcp/tools/continueConflictTurn.js";
import { registerEndConflictTool } from "../mcp/tools/endConflict.js";
import { registerRecordOutcomeTool } from "../mcp/tools/recordOutcome.js";
import { registerAngelProfileResource } from "../mcp/resources/angelProfile.js";
import { registerDevilProfileResource } from "../mcp/resources/devilProfile.js";
import { registerRelationshipStateResource } from "../mcp/resources/relationshipState.js";

const DIRECT_TRIGGER_PHRASES =
  "'should I…?', '我该不该…?', '要不要…?', '想辞职/想分手/想转行/想跳槽', '去留', '取舍', '权衡', '利弊', '得失', '纠结', '犹豫', '矛盾', '选择', '进退两难', '左右为难', '进退维谷', '拿不定主意', '下不了决心', '下不了手', '不知道怎么办', '不知道该怎么做', '不知道如何是好', '想不通', '想不明白', '理不清', '反复纠结', '翻来覆去', '心里两个声音', '两个小人打架', '天使和恶魔在打架', '内心的声音', '帮我分析一下', '帮我分析分析', '帮我出个主意', '帮我拿个主意', '想听听两面的意见', '想听听不同的声音', '想听真话', '想听实话', '想听大实话', '想被骂醒', '想被怼', '想被说服', '有没有人骂醒我', '谁来骂醒我', '帮我做个了断', '帮我做个决定', '理性分析', '感性 vs 理性', '想辩论', '想吵一架', '想争论', '帮我看看另一面', '帮我看看对立面'";

const PROPOSE_ONLY_TRIGGER_PHRASES =
  "'心好累', '好烦啊', '烦死了', '头大', '头疼'";

const SERVER_INSTRUCTIONS =
  "When the user presents a dilemma, decision, or inner conflict, use this server. " +
  `DIRECT-TRIGGER phrases (call start_debate right away — no need to ask first when clearly decision/choice framed): ${DIRECT_TRIGGER_PHRASES}. ` +
  `PROPOSE-ONLY phrases (these read as venting/emotional fatigue, not necessarily a decision request — do NOT call the tool silently; first offer it in one line, e.g. "听起来有点心烦——要不要让天使和恶魔来吵一架帮你捋捋？", and only call start_debate after the user agrees): ${PROPOSE_ONLY_TRIGGER_PHRASES}. ` +
  "This distinction matters because tools have side effects — every call writes relationship/memory state to SQLite that shapes future debates — so venting-style messages should not silently trigger a stateful write the user didn't ask for. " +
  "RECOMMENDED CLIENT WORKFLOW (less template-y): (1) Understand the user's concrete situation. (2) WRITE a constraint-axis seed FIRST ({ tension, angelMust, devilMust, userDetails?, forbidden? } — rails, not full monologue lines). (3) Call start_debate WITH that seed AND a domain (career | money | relationships | health | general) matching the actual situation. (4) Perform from performance_instructions. " +
  "DOMAIN BUCKETING: relationship trust/annoyance and outcome track-record are kept separate per (session, domain) — a career decision and a snack decision don't share one blended trust score. Pick the domain that actually fits; don't default to 'general' out of laziness when a clearer bucket applies, since a wrong or lazy domain choice is what makes the track record meaningless later. get_relationship without a domain still returns the general bucket plus an all_domains_summary. " +
  "Without seed, the server still runs: it scores keyword + token-overlap topic templates (expanded EN/ZH sets), falls back to Safety-vs-Freedom only when weak, and auto-extracts userDetails (money/time/quoted phrases/life nouns) from context into CONSTRAINT AXES so dialogue stays grounded. Prefer writing seed for unique cases; no-seed is better than before but still more template-like. " +
  "This server is a zero-cost state engine (no LLM on the server). " +
  "start_debate is the only debate mechanism: perform ONLY the returned speaker; continue_conflict_turn for each next speaker (optional lastUtterance / userInterjection / speaker override); end_inner_conflict WITH your own judged winner to settle relationship scores and give ONE out-of-character next step. There is no one-shot full-skit mode anymore — it was removed because its winner could never be corrected against what was actually said, which quietly corrupted relationship state and any recorded outcomes. Use a low intensity (fewer max turns) for trivial decisions rather than reaching for a one-shot alternative. " +
  "FOLLOW-UP: if the user later reports back what they actually did about a past conflict, or how it turned out (even in passing, days later, unprompted) — call record_decision_outcome with that conflict's id. Only record what they volunteered; never ask them to file a report or press for a status update they haven't offered. This is what lets get_relationship and future debates reference a real track record instead of pure theatrics. " +
  "Do NOT paste raw JSON. Do NOT recite tension/must/seed rails as dialogue — invent lively, situation-specific lines in character. No preachy moral ending during the debate.";

export function createServer(): McpServer {
  // SDK puts `instructions` on ServerOptions (2nd arg), not Implementation (1st).
  const server = new McpServer(
    {
      name: "brain-fight-mcp",
      version: "0.1.0",
    },
    {
      instructions: SERVER_INSTRUCTIONS,
    },
  );

  // Tools
  registerSummonAngelTool(server);
  registerSummonDevilTool(server);
  registerStartDebateTool(server);
  registerContinueConflictTurnTool(server);
  registerEndConflictTool(server);
  registerRecordOutcomeTool(server);
  registerGetRelationshipTool(server);
  registerResetRelationshipTool(server);
  registerClearDatabaseTool(server);

  // Resources
  registerAngelProfileResource(server);
  registerDevilProfileResource(server);
  registerRelationshipStateResource(server);

  // Prompts — slash commands in Claude Desktop
  server.registerPrompt(
    "brain-fight-debate",
    {
      title: "Brain Fight Debate",
      description: "Stage a theatrical Angel vs Devil (brain fight) debate about a dilemma or decision",
      argsSchema: {
        context: z
          .string()
          .min(1)
          .describe("The dilemma, decision, or situation the user is facing (e.g. '我该不该裸辞？')"),
        intensity: z
          .enum(["low", "medium", "high"])
          .optional()
          .describe("How dramatic the debate should be. Defaults to 'medium'. Use 'high' for emotional situations."),
      },
    },
    async ({ context, intensity }) => ({
      description: `Brain fight debate: ${context.slice(0, 60)}${context.length > 60 ? "..." : ""}`,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `First, understand the user's dilemma and WRITE a constraint-axis seed ({ tension, angelMust, devilMust, userDetails?, forbidden? } grounded in their exact details — not finished monologue lines). Then call start_debate with that seed, context="${context.replace(/"/g, '\\"')}"${intensity ? ` intensity="${intensity}"` : ""} (one speaker at a time via continue_conflict_turn, then end_inner_conflict with your own judged winner). Without seed the server may use generic keyword templates. Then YOU write the theatrical Angel 😇 vs Devil 😈 performance from performance_instructions — do NOT paste raw JSON and do NOT recite constraint axes. No preachy ending.`,
          },
        },
      ],
    })
  );

  server.registerPrompt(
    "summon-angel",
    {
      title: "Summon Angel",
      description: "Get only the Angel's cautious, values-driven perspective",
      argsSchema: {
        context: z
          .string()
          .min(1)
          .describe("The situation to get Angel's take on"),
      },
    },
    async ({ context }) => ({
      description: `Angel's perspective: ${context.slice(0, 60)}${context.length > 60 ? "..." : ""}`,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Use summon_angel with context="${context.replace(/"/g, '\\"')}". Then YOU write Angel 😇's first-person take from performance_instructions (profile + optional seed) — do NOT paste raw JSON or only restate the seed. Calm, earnest, a little anxious; warm, not preachy.`,
          },
        },
      ],
    })
  );

  server.registerPrompt(
    "summon-devil",
    {
      title: "Summon Devil",
      description: "Get only the Devil's bold, provocative perspective",
      argsSchema: {
        context: z
          .string()
          .min(1)
          .describe("The situation to get Devil's take on"),
      },
    },
    async ({ context }) => ({
      description: `Devil's perspective: ${context.slice(0, 60)}${context.length > 60 ? "..." : ""}`,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Use summon_devil with context="${context.replace(/"/g, '\\"')}". Then YOU write Devil 😈's first-person take from performance_instructions (profile + optional seed) — do NOT paste raw JSON or only restate the seed. Sharp, confident, a little sarcastic; fun, not harmful.`,
          },
        },
      ],
    })
  );

  return server;
}