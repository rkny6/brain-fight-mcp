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
  "start_inner_conflict",
  "get_relationship",
  "reset_relationship",
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

  it("lists all five tools", async () => {
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
  });

  it("start_inner_conflict persists state and updates the relationship", async () => {
    const sessionId = "conflict-flow";

    const conflictResult = await client.callTool({
      name: "start_inner_conflict",
      arguments: {
        context: "I'm thinking about whether I should quit my job",
        intensity: "high",
        sessionId,
      },
    });

    const conflict = parseToolJson<{
      context: string;
      angel: { position: string; reasoning: string };
      devil: { position: string; reasoning: string };
      conflict: {
        id: string;
        coreDisagreement: string;
        likelyWinner: string | null;
        isRoleReversal: boolean;
        absurdityLevel: number;
      };
      continuity: { hasPrior: boolean };
      relationship: {
        sessionId: string;
        totalConflicts: number;
        recentWinner: string | null;
      };
      recent_memory: Array<{ id: string; context: string }>;
      performance_instructions: string;
    }>(conflictResult as { content: Array<{ type: string; text?: string }> });

    expect(conflict.context).toContain("quit my job");
    expect(conflict.angel.position).toBeTruthy();
    expect(conflict.devil.position).toBeTruthy();
    expect(conflict.conflict.absurdityLevel).toBe(0.9);
    expect(conflict.conflict.coreDisagreement).toMatch(/security|momentum/i);
    expect(conflict.relationship.sessionId).toBe(sessionId);
    expect(conflict.relationship.totalConflicts).toBe(1);
    expect(conflict.recent_memory).toHaveLength(1);
    expect(conflict.performance_instructions).toMatch(/debate|Angel|Devil/i);
    expect(conflict.continuity.hasPrior).toBe(false);


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
    expect(rel.relationship.recentWinner).toBe(conflict.conflict.likelyWinner);
    expect(rel.recent_memory[0].context).toContain("quit my job");
  });

  it("reset_relationship requires confirm and can wipe a session", async () => {
    const sessionId = "reset-flow";

    await client.callTool({
      name: "start_inner_conflict",
      arguments: {
        context: "Should I apologize first?",
        sessionId,
      },
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

  it("injects continuity from the previous conflict on round two", async () => {
    const sessionId = "continuity-arc";

    const round1 = await client.callTool({
      name: "start_inner_conflict",
      arguments: {
        context: "I'm thinking about whether I should quit my job",
        intensity: "medium",
        sessionId,
      },
    });
    const first = parseToolJson<{
      angel: { position: string };
      conflict: { likelyWinner: string | null };
      continuity: { hasPrior: boolean };
    }>(round1 as { content: Array<{ type: string; text?: string }> });

    expect(first.continuity.hasPrior).toBe(false);

    const round2 = await client.callTool({
      name: "start_inner_conflict",
      arguments: {
        context: "If I'm not panicking anymore, can I leave now?",
        intensity: "high",
        sessionId,
      },
    });
    const second = parseToolJson<{
      angel: { reasoning: string };
      devil: { reasoning: string };
      continuity: {
        hasPrior: boolean;
        prior: { angelPosition: string; winner: string | null } | null;
      };
      performance_instructions: string;
      relationship: { totalConflicts: number };
      recent_memory: unknown[];
    }>(round2 as { content: Array<{ type: string; text?: string }> });

    expect(second.continuity.hasPrior).toBe(true);
    expect(second.continuity.prior?.angelPosition).toBe(first.angel.position);
    expect(second.angel.reasoning).toContain(first.angel.position);
    expect(second.devil.reasoning).toContain(first.angel.position);
    expect(second.performance_instructions).toContain("CONTINUITY");
    expect(second.performance_instructions).toContain(first.angel.position);
    expect(second.relationship.totalConflicts).toBe(2);
    expect(second.recent_memory).toHaveLength(2);
  });

  it("keeps relationship state isolated between sessions", async () => {

    await client.callTool({
      name: "start_inner_conflict",
      arguments: {
        context: "Should I quit my job?",
        sessionId: "alpha",
      },
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
    await client.callTool({
      name: "start_inner_conflict",
      arguments: {
        context: "generic dilemma with no special keywords",
        sessionId,
      },
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
