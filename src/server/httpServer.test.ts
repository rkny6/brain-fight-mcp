import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { startHttpServer, type StartedHttpServer } from "./httpServer.js";
import {
  parseToolJson,
  setupIsolatedDb,
  teardownIsolatedDb,
} from "../test/helpers.js";

describe("Streamable HTTP MCP server", () => {
  let dbPath = "";
  let started: StartedHttpServer | undefined;

  beforeEach(() => {
    dbPath = setupIsolatedDb();
  });

  afterEach(async () => {
    if (started) {
      await started.close();
      started = undefined;
    }
    teardownIsolatedDb(dbPath);
  });

  it("serves /health and lists tools over Streamable HTTP", async () => {
    started = await startHttpServer({ host: "127.0.0.1", port: 0 });

    const health = await fetch(`${started.url}/health`);
    expect(health.status).toBe(200);
    const healthBody = (await health.json()) as { ok: boolean; transport: string };
    expect(healthBody.ok).toBe(true);
    expect(healthBody.transport).toBe("streamable-http");

    const client = new Client({ name: "http-test", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(started.mcpUrl));
    await client.connect(transport);

    try {
      const listed = await client.listTools();
      const names = listed.tools.map((t) => t.name).sort();
      expect(names).toContain("start_debate");
      expect(names).toContain("record_decision_outcome");
      expect(names).toContain("summon_angel");
    } finally {
      await client.close();
    }
  });

  it("rejects missing token when auth is configured", async () => {
    started = await startHttpServer({
      host: "127.0.0.1",
      port: 0,
      token: "test-secret",
    });

    const unauth = await fetch(started.mcpUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "x", version: "0" },
        },
      }),
    });
    expect(unauth.status).toBe(401);

    const client = new Client({ name: "http-auth-test", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(started.mcpUrl), {
      requestInit: {
        headers: {
          Authorization: "Bearer test-secret",
        },
      },
    });
    await client.connect(transport);

    try {
      const result = await client.callTool({
        name: "summon_angel",
        arguments: {
          context: "Should I quit my job?",
          sessionId: "http-auth",
        },
      });

      const body = parseToolJson<{
        profile: { archetype: string };
        performance_instructions: string;
      }>(result as { content: Array<{ type: string; text?: string }> });

      expect(body.profile.archetype).toBe("angel");
      expect(body.performance_instructions.toLowerCase()).toContain("angel");
    } finally {
      await client.close();
    }
  });

  it("runs start_debate over HTTP", async () => {
    started = await startHttpServer({ host: "127.0.0.1", port: 0 });

    const client = new Client({ name: "http-conflict-test", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(started.mcpUrl));
    await client.connect(transport);

    try {
      const result = await client.callTool({
        name: "start_debate",
        arguments: {
          context: "Should I quit my job?",
          intensity: "medium",
          sessionId: "http-conflict",
        },
      });

      const body = parseToolJson<{
        angel: { position: string };
        devil: { position: string };
        performance_instructions: string;
      }>(result as { content: Array<{ type: string; text?: string }> });

      expect(body.angel.position.length).toBeGreaterThan(0);
      expect(body.devil.position.length).toBeGreaterThan(0);
      expect(body.performance_instructions.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });
});
