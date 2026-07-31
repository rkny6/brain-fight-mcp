import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./createServer.js";
import {
  parseToolJson,
  setupIsolatedDb,
  teardownIsolatedDb,
} from "../test/helpers.js";
import { DEFAULT_RELATIONSHIP_STATE } from "../types/index.js";

const EXPECTED_TOOLS = [
  "summon_angel",
  "summon_devil",
  "start_debate",
  "continue_conflict_turn",
  "end_inner_conflict",
  "record_decision_outcome",
  "get_relationship",
  "reset_relationship",
  "clear_database",
] as const;

async function connectTestClient(): Promise<{
  client: Client;
  close: () => Promise<void>;
}> {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "integration-test", version: "0.0.0" });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

/**
 * Runs a debate to settlement via start_debate with intensity "low" (2 max
 * turns), then ends it. One-shot full mode no longer exists, so any test
 * that just needs "a settled conflict" for setup has to walk this whole
 * sequence now.
 */
async function runDebateToSettlement(
  client: Client,
  args: {
    context: string;
    sessionId: string;
    winner?: "angel" | "devil" | "draw";
    extraStartArgs?: Record<string, unknown>;
  },
): Promise<{
  conflictId: string;
  ended: {
    ok: boolean;
    ended: boolean;
    winner: string;
    relationship: { totalConflicts: number; recentWinner: string | null };
    conflict: { id: string };
    performance_instructions: string;
  };
}> {
  const openResult = await client.callTool({
    name: "start_debate",
    arguments: {
      context: args.context,
      sessionId: args.sessionId,
      intensity: "low",
      ...args.extraStartArgs,
    },
  });
  const opened = parseToolJson<{
    conflictId: string;
    turn: { shouldEnd: boolean };
  }>(openResult as { content: Array<{ type: string; text?: string }> });

  if (!opened.turn.shouldEnd) {
    await client.callTool({
      name: "continue_conflict_turn",
      arguments: { sessionId: args.sessionId, conflictId: opened.conflictId },
    });
  }

  const endResult = await client.callTool({
    name: "end_inner_conflict",
    arguments: {
      sessionId: args.sessionId,
      conflictId: opened.conflictId,
      winner: args.winner ?? "angel",
    },
  });
  const ended = parseToolJson<{
    ok: boolean;
    ended: boolean;
    winner: string;
    relationship: { totalConflicts: number; recentWinner: string | null };
    conflict: { id: string };
    performance_instructions: string;
    milestones_reached: string[];
  }>(endResult as { content: Array<{ type: string; text?: string }> });

  return { conflictId: opened.conflictId, ended };
}

describe("MCP server (integration)", () => {
  let dbPath = "";
  let client: Client;
  let close: () => Promise<void>;

  beforeEach(async () => {
    dbPath = setupIsolatedDb();
    ({ client, close } = await connectTestClient());
  });

  afterEach(async () => {
    await close();
    teardownIsolatedDb(dbPath);
  });

  it("lists all registered tools", async () => {
    const listed = await client.listTools();
    const names = listed.tools.map((t) => t.name).sort();
    expect(names).toEqual([...EXPECTED_TOOLS].sort());
  });

  it("exposes angel and devil profile resources", async () => {
    const angel = await client.readResource({ uri: "angel://profile" });
    const devil = await client.readResource({ uri: "devil://profile" });

    const angelProfile = JSON.parse(angel.contents[0].text as string);
    const devilProfile = JSON.parse(devil.contents[0].text as string);

    expect(angelProfile.archetype).toBe("angel");
    expect(angelProfile.name).toBe("Angel");
    expect(devilProfile.archetype).toBe("devil");
    expect(devilProfile.name).toBe("Devil");
  });

  it("summon_angel returns a cautious perspective with performance instructions", async () => {
    const result = await client.callTool({
      name: "summon_angel",
      arguments: {
        context: "I'm thinking about whether I should quit my job tomorrow",
        sessionId: "summon-angel",
      },
    });

    const body = parseToolJson<{
      profile: { archetype: string };
      perspective: { position: string; concern?: string };
      performance_instructions: string;
    }>(result as { content: Array<{ type: string; text?: string }> });

    expect(body.profile.archetype).toBe("angel");
    expect(body.perspective.position.toLowerCase()).toMatch(/quit|plan|don't/);
    expect(body.perspective.concern).toBeTruthy();
    expect(body.performance_instructions.toLowerCase()).toContain("angel");
    expect(body.performance_instructions).toMatch(/GENERATE|Client LLM/i);
  });

  it("summon_devil returns a bold perspective with performance instructions", async () => {
    const result = await client.callTool({
      name: "summon_devil",
      arguments: {
        context: "Should I buy this expensive gadget right now?",
        sessionId: "summon-devil",
      },
    });

    const body = parseToolJson<{
      profile: { archetype: string };
      perspective: { position: string; temptation?: string };
      performance_instructions: string;
    }>(result as { content: Array<{ type: string; text?: string }> });

    expect(body.profile.archetype).toBe("devil");
    expect(body.perspective.temptation).toBeTruthy();
    expect(body.performance_instructions.toLowerCase()).toContain("devil");
    expect(body.performance_instructions).toMatch(/GENERATE|Client LLM/i);
  });

  it("start_debate through end_inner_conflict persists state and updates the relationship", async () => {
    const sessionId = "conflict-flow";

    const { ended } = await runDebateToSettlement(client, {
      context: "I'm thinking about whether I should quit my job",
      sessionId,
      winner: "angel",
    });

    expect(ended.ok).toBe(true);
    expect(ended.relationship.totalConflicts).toBe(1);
    expect(ended.relationship.recentWinner).toBe("angel");
    expect(ended.performance_instructions).toMatch(/DEBATE CLOSED|OUT of character/i);

    const relResult = await client.callTool({
      name: "get_relationship",
      arguments: { sessionId },
    });

    const rel = parseToolJson<{
      relationship: {
        totalConflicts: number;
        recentWinner: string | null;
        angelRespect: number;
      };
      recent_memory: Array<{ context: string }>;
    }>(relResult as { content: Array<{ type: string; text?: string }> });

    expect(rel.relationship.totalConflicts).toBe(1);
    expect(rel.relationship.recentWinner).toBe("angel");
    expect(rel.recent_memory[0].context).toContain("quit my job");
  });

  it("reset_relationship requires confirm and can wipe a session", async () => {
    const sessionId = "reset-flow";

    await runDebateToSettlement(client, {
      context: "Should I apologize first?",
      sessionId,
    });

    const denied = await client.callTool({
      name: "reset_relationship",
      arguments: { sessionId, confirm: false },
    });
    const deniedBody = parseToolJson<{ reset: boolean; message: string }>(
      denied as { content: Array<{ type: string; text?: string }> }
    );
    expect(deniedBody.reset).toBe(false);

    const stillThere = await client.callTool({
      name: "get_relationship",
      arguments: { sessionId },
    });
    const still = parseToolJson<{
      relationship: { totalConflicts: number };
      recent_memory: unknown[];
    }>(stillThere as { content: Array<{ type: string; text?: string }> });
    expect(still.relationship.totalConflicts).toBe(1);
    expect(still.recent_memory).toHaveLength(1);

    const confirmed = await client.callTool({
      name: "reset_relationship",
      arguments: { sessionId, confirm: true },
    });
    const resetBody = parseToolJson<{
      reset: boolean;
      relationship: {
        totalConflicts: number;
        angelRespect: number;
        recentWinner: string | null;
      };
    }>(confirmed as { content: Array<{ type: string; text?: string }> });

    expect(resetBody.reset).toBe(true);
    expect(resetBody.relationship.totalConflicts).toBe(0);
    expect(resetBody.relationship.recentWinner).toBeNull();
    expect(resetBody.relationship.angelRespect).toBe(
      DEFAULT_RELATIONSHIP_STATE.angelRespect
    );

    const after = await client.callTool({
      name: "get_relationship",
      arguments: { sessionId },
    });
    const afterBody = parseToolJson<{
      relationship: { totalConflicts: number };
      recent_memory: unknown[];
    }>(after as { content: Array<{ type: string; text?: string }> });
    expect(afterBody.relationship.totalConflicts).toBe(0);
    expect(afterBody.recent_memory).toHaveLength(0);
  });

  it("start_debate opens, continues alternating, and ends with relationship settle", async () => {
    const sessionId = "turn-flow";

    const openResult = await client.callTool({
      name: "start_debate",
      arguments: {
        context: "Should I quit my job tomorrow?",
        intensity: "low",
        firstSpeaker: "devil",
        sessionId,
      },
    });
    const opened = parseToolJson<{
      mode: string;
      conflictId: string;
      turn: {
        index: number;
        maxTurns: number;
        speaker: string;
        shouldEnd: boolean;
      };
      relationship: { totalConflicts: number };
      performance_instructions: string;
    }>(openResult as { content: Array<{ type: string; text?: string }> });

    expect(opened.mode).toBe("turn");
    expect(opened.turn.speaker).toBe("devil");
    expect(opened.turn.index).toBe(1);
    expect(opened.turn.maxTurns).toBe(2);
    expect(opened.relationship.totalConflicts).toBe(0);
    expect(opened.performance_instructions).toMatch(/ONLY SPEAKER/i);
    expect(opened.performance_instructions.toLowerCase()).toContain("devil");

    const midRel = await client.callTool({
      name: "get_relationship",
      arguments: { sessionId },
    });
    const mid = parseToolJson<{
      relationship: { totalConflicts: number };
      recent_memory: unknown[];
    }>(midRel as { content: Array<{ type: string; text?: string }> });
    expect(mid.relationship.totalConflicts).toBe(0);
    expect(mid.recent_memory).toHaveLength(0);

    const contResult = await client.callTool({
      name: "continue_conflict_turn",
      arguments: {
        sessionId,
        conflictId: opened.conflictId,
        lastUtterance: "Devil: Quit. Send the email.",
      },
    });
    const cont = parseToolJson<{
      ok: boolean;
      turn: {
        index: number;
        speaker: string;
        shouldEnd: boolean;
      };
      performance_instructions: string;
    }>(contResult as { content: Array<{ type: string; text?: string }> });

    expect(cont.ok).toBe(true);
    expect(cont.turn.index).toBe(2);
    expect(cont.turn.speaker).toBe("angel");
    expect(cont.turn.shouldEnd).toBe(true);
    expect(cont.performance_instructions).toMatch(/ONLY SPEAKER/i);
    expect(cont.performance_instructions.toLowerCase()).toContain("angel");

    const pastCap = await client.callTool({
      name: "continue_conflict_turn",
      arguments: { sessionId, conflictId: opened.conflictId },
    });
    const pastBody = parseToolJson<{ ok: boolean; error: string }>(
      pastCap as { content: Array<{ type: string; text?: string }> },
    );
    expect(pastBody.ok).toBe(false);
    expect(pastBody.error).toBe("max_turns_reached");

    const endResult = await client.callTool({
      name: "end_inner_conflict",
      arguments: {
        sessionId,
        conflictId: opened.conflictId,
        winner: "angel",
        lastUtterance: "Angel: Wait — pad the runway first.",
      },
    });
    const ended = parseToolJson<{
      ok: boolean;
      ended: boolean;
      winner: string;
      relationship: { totalConflicts: number; recentWinner: string | null };
      performance_instructions: string;
    }>(endResult as { content: Array<{ type: string; text?: string }> });

    expect(ended.ok).toBe(true);
    expect(ended.ended).toBe(true);
    expect(ended.winner).toBe("angel");
    expect(ended.relationship.totalConflicts).toBe(1);
    expect(ended.relationship.recentWinner).toBe("angel");
    expect(ended.performance_instructions).toMatch(/DEBATE CLOSED|OUT of character/i);

    const forceOpen = await client.callTool({
      name: "start_debate",
      arguments: {
        context: "Should I text my ex?",
        intensity: "medium",
        firstSpeaker: "angel",
        sessionId,
      },
    });
    const forced = parseToolJson<{
      conflictId: string;
      turn: { speaker: string; index: number };
    }>(forceOpen as { content: Array<{ type: string; text?: string }> });
    expect(forced.turn.speaker).toBe("angel");

    const forceCont = await client.callTool({
      name: "continue_conflict_turn",
      arguments: {
        sessionId,
        conflictId: forced.conflictId,
        speaker: "angel",
        userInterjection: "Angel, be honest — is this nostalgia?",
      },
    });
    const forcedTurn = parseToolJson<{
      turn: { speaker: string; isDoubleTap: boolean };
      performance_instructions: string;
    }>(forceCont as { content: Array<{ type: string; text?: string }> });
    expect(forcedTurn.turn.speaker).toBe("angel");
    expect(forcedTurn.turn.isDoubleTap).toBe(true);
    expect(forcedTurn.performance_instructions).toMatch(/USER INTERJECTION|DOUBLE-TAP/i);
  });

  it("fires the conflicts_10 milestone exactly once, on the 10th completed debate in a domain", async () => {
    const sessionId = "milestone-e2e";
    const results: { totalConflicts: number; milestones: string[] }[] = [];

    for (let i = 0; i < 11; i += 1) {
      const { ended } = await runDebateToSettlement(client, {
        context: `filler decision number ${i}`,
        sessionId,
        extraStartArgs: { domain: "career" },
      });
      results.push({
        totalConflicts: ended.relationship.totalConflicts,
        milestones: ended.milestones_reached,
      });
    }

    // The 10th completed debate (index 9, totalConflicts becomes 10) fires it.
    expect(results[8].totalConflicts).toBe(9);
    expect(results[8].milestones).not.toContain("conflicts_10");
    expect(results[9].totalConflicts).toBe(10);
    expect(results[9].milestones).toContain("conflicts_10");
    // The 11th must NOT re-fire it.
    expect(results[10].totalConflicts).toBe(11);
    expect(results[10].milestones).not.toContain("conflicts_10");

    // get_relationship must also be able to see it was reached.
    const relResult = await client.callTool({
      name: "get_relationship",
      arguments: { sessionId, domain: "career" },
    });
    const rel = parseToolJson<{
      milestones_reached: Array<{ key: string; domain: string }>;
    }>(relResult as { content: Array<{ type: string; text?: string }> });
    expect(rel.milestones_reached.some((m) => m.key === "conflicts_10")).toBe(true);

    // A different domain, same session, must NOT have this milestone —
    // domain isolation applies to milestones too.
    const otherDomainResult = await client.callTool({
      name: "get_relationship",
      arguments: { sessionId, domain: "money" },
    });
    const otherDomain = parseToolJson<{
      milestones_reached: Array<{ key: string; domain: string }>;
    }>(otherDomainResult as { content: Array<{ type: string; text?: string }> });
    expect(otherDomain.milestones_reached).toHaveLength(0);
  });

  it("clear_database requires confirm and wipes all sessions", async () => {
    await runDebateToSettlement(client, {
      context: "Should I quit my job?",
      sessionId: "clear-db-a",
    });
    await runDebateToSettlement(client, {
      context: "Should I buy this now?",
      sessionId: "clear-db-b",
    });

    const denied = await client.callTool({
      name: "clear_database",
      arguments: { confirm: false },
    });
    const deniedBody = parseToolJson<{ cleared: boolean; message: string }>(
      denied as { content: Array<{ type: string; text?: string }> },
    );
    expect(deniedBody.cleared).toBe(false);

    const stillA = await client.callTool({
      name: "get_relationship",
      arguments: { sessionId: "clear-db-a" },
    });
    const stillABody = parseToolJson<{
      relationship: { totalConflicts: number };
      recent_memory: unknown[];
    }>(stillA as { content: Array<{ type: string; text?: string }> });
    expect(stillABody.relationship.totalConflicts).toBe(1);
    expect(stillABody.recent_memory).toHaveLength(1);

    const confirmed = await client.callTool({
      name: "clear_database",
      arguments: { confirm: true },
    });
    const clearBody = parseToolJson<{
      cleared: boolean;
      deleted: { relationshipsDeleted: number; conflictsDeleted: number };
    }>(confirmed as { content: Array<{ type: string; text?: string }> });

    expect(clearBody.cleared).toBe(true);
    expect(clearBody.deleted.relationshipsDeleted).toBeGreaterThanOrEqual(2);
    expect(clearBody.deleted.conflictsDeleted).toBeGreaterThanOrEqual(2);

    for (const sessionId of ["clear-db-a", "clear-db-b"] as const) {
      const after = await client.callTool({
        name: "get_relationship",
        arguments: { sessionId },
      });
      const afterBody = parseToolJson<{
        relationship: {
          totalConflicts: number;
          angelRespect: number;
          recentWinner: string | null;
        };
        recent_memory: unknown[];
      }>(after as { content: Array<{ type: string; text?: string }> });

      // getOrCreate recreates a default row after a full wipe.
      expect(afterBody.relationship.totalConflicts).toBe(0);
      expect(afterBody.relationship.recentWinner).toBeNull();
      expect(afterBody.relationship.angelRespect).toBe(
        DEFAULT_RELATIONSHIP_STATE.angelRespect,
      );
      expect(afterBody.recent_memory).toHaveLength(0);
    }
  });

  it("injects continuity from the previous conflict on round two", async () => {
    const sessionId = "continuity-arc";

    const round1Open = await client.callTool({
      name: "start_debate",
      arguments: {
        context: "I'm thinking about whether I should quit my job",
        intensity: "low",
        sessionId,
      },
    });
    const first = parseToolJson<{
      conflictId: string;
      angel: { position: string };
      continuity: { hasPrior: boolean };
      turn: { shouldEnd: boolean };
    }>(round1Open as { content: Array<{ type: string; text?: string }> });

    expect(first.continuity.hasPrior).toBe(false);

    if (!first.turn.shouldEnd) {
      await client.callTool({
        name: "continue_conflict_turn",
        arguments: { sessionId, conflictId: first.conflictId },
      });
    }
    await client.callTool({
      name: "end_inner_conflict",
      arguments: { sessionId, conflictId: first.conflictId, winner: "angel" },
    });

    const round2Open = await client.callTool({
      name: "start_debate",
      arguments: {
        context: "If I'm not panicking anymore, can I leave now?",
        intensity: "low",
        sessionId,
      },
    });
    const second = parseToolJson<{
      conflictId: string;
      angel: { reasoning: string };
      devil: { reasoning: string };
      continuity: {
        hasPrior: boolean;
        prior: { angelPosition: string; winner: string | null } | null;
      };
      performance_instructions: string;
      relationship: { totalConflicts: number };
      recent_memory: unknown[];
      turn: { shouldEnd: boolean };
    }>(round2Open as { content: Array<{ type: string; text?: string }> });

    expect(second.continuity.hasPrior).toBe(true);
    expect(second.continuity.prior?.angelPosition).toBe(first.angel.position);
    expect(second.angel.reasoning).toContain(first.angel.position);
    expect(second.devil.reasoning).toContain(first.angel.position);
    expect(second.performance_instructions).toContain("CONTINUITY");
    expect(second.performance_instructions).toContain(first.angel.position);
    // relationship/recent_memory here reflect state BEFORE round two settles.
    expect(second.relationship.totalConflicts).toBe(1);
    expect(second.recent_memory).toHaveLength(1);

    if (!second.turn.shouldEnd) {
      await client.callTool({
        name: "continue_conflict_turn",
        arguments: { sessionId, conflictId: second.conflictId },
      });
    }
    const round2End = await client.callTool({
      name: "end_inner_conflict",
      arguments: { sessionId, conflictId: second.conflictId, winner: "angel" },
    });
    const ended2 = parseToolJson<{ relationship: { totalConflicts: number } }>(
      round2End as { content: Array<{ type: string; text?: string }> },
    );
    expect(ended2.relationship.totalConflicts).toBe(2);
  });

  it("keeps relationship state isolated between sessions", async () => {

    await runDebateToSettlement(client, {
      context: "Should I quit my job?",
      sessionId: "alpha",
    });

    const beta = await client.callTool({
      name: "get_relationship",
      arguments: { sessionId: "beta" },
    });
    const betaBody = parseToolJson<{
      relationship: { totalConflicts: number };
      recent_memory: unknown[];
    }>(beta as { content: Array<{ type: string; text?: string }> });

    expect(betaBody.relationship.totalConflicts).toBe(0);
    expect(betaBody.recent_memory).toHaveLength(0);

    const alpha = await client.callTool({
      name: "get_relationship",
      arguments: { sessionId: "alpha" },
    });
    const alphaBody = parseToolJson<{
      relationship: { totalConflicts: number };
    }>(alpha as { content: Array<{ type: string; text?: string }> });
    expect(alphaBody.relationship.totalConflicts).toBe(1);
  });

  it("reads relationship state via resource after a conflict", async () => {
    const sessionId = "resource-session";
    await runDebateToSettlement(client, {
      context: "generic dilemma with no special keywords",
      sessionId,
    });

    const resource = await client.readResource({
      uri: `relationship://state/${sessionId}`,
    });
    const state = JSON.parse(resource.contents[0].text as string);

    expect(state.sessionId).toBe(sessionId);
    expect(state.totalConflicts).toBe(1);
    expect(state.recentWinner).not.toBeUndefined();
  });
});
