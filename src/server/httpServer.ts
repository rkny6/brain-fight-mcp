import { randomUUID, timingSafeEqual } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer } from "./createServer.js";

export interface HttpServerOptions {
  /** Bind address. Defaults to 127.0.0.1. Use 0.0.0.0 only behind a tunnel/proxy. */
  host?: string;
  /** TCP port. Use 0 to pick an ephemeral free port (useful in tests). */
  port?: number;
  /**
   * Shared secret for Bearer / query-token auth.
   * If omitted, the endpoint is open to anyone who can reach the host:port.
   */
  token?: string;
  /**
   * Optional Host header allow-list (DNS rebinding protection).
   * When omitted, host validation is disabled so tunnels (public Host headers) work.
   */
  allowedHosts?: string[];
  /** Factory for MCP servers. Defaults to createServer. Overridable in tests. */
  createMcpServer?: () => McpServer;
}

export interface StartedHttpServer {
  host: string;
  port: number;
  url: string;
  mcpUrl: string;
  close: () => Promise<void>;
}

type SessionEntry = {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
};

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (typeof header === "string") {
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  const queryToken = req.query.token;
  if (typeof queryToken === "string" && queryToken.length > 0) {
    return queryToken;
  }

  return undefined;
}

function authMiddleware(token: string | undefined) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!token) {
      next();
      return;
    }

    const provided = extractToken(req);
    if (!provided || !safeEqual(provided, token)) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Unauthorized: provide Authorization: Bearer <token> or ?token=",
        },
        id: null,
      });
      return;
    }

    next();
  };
}

/**
 * Starts a Streamable HTTP MCP endpoint at /mcp (plus a tiny /health check).
 *
 * Session model: one transport + McpServer per MCP session id (stateful).
 * Application state (relationship scores, memory) still lives in SQLite and is
 * keyed by tool `sessionId`, independent of the HTTP MCP session.
 */
export async function startHttpServer(
  options: HttpServerOptions = {},
): Promise<StartedHttpServer> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8000;
  const token = options.token?.trim() || undefined;
  const createMcpServer = options.createMcpServer ?? createServer;

  // createMcpExpressApp enables localhost Host validation for loopback hosts.
  // That breaks tunnels (public Host headers hit a 127.0.0.1 bind). Default is
  // tunnel-friendly: plain express + JSON parser, no Host allow-list unless the
  // caller passes allowedHosts.
  const app: Express = options.allowedHosts?.length
    ? createMcpExpressApp({ host, allowedHosts: options.allowedHosts })
    : express().use(express.json());

  const sessions = new Map<string, SessionEntry>();

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      name: "brain-fight-mcp",
      transport: "streamable-http",
      auth: Boolean(token),
      sessions: sessions.size,
    });
  });

  app.use("/mcp", authMiddleware(token));

  app.all("/mcp", async (req: Request, res: Response) => {
    try {
      const sessionHeader = req.headers["mcp-session-id"];
      const sessionId =
        typeof sessionHeader === "string"
          ? sessionHeader
          : Array.isArray(sessionHeader)
            ? sessionHeader[0]
            : undefined;

      if (sessionId && sessions.has(sessionId)) {
        const entry = sessions.get(sessionId)!;
        await entry.transport.handleRequest(req, res, req.body);
        return;
      }

      if (!sessionId && isInitializeRequest(req.body)) {
        const server = createMcpServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            sessions.set(id, { transport, server });
          },
          onsessionclosed: (id) => {
            const entry = sessions.get(id);
            sessions.delete(id);
            void entry?.server.close().catch(() => undefined);
          },
        });

        transport.onclose = () => {
          const id = transport.sessionId;
          if (!id) return;
          const entry = sessions.get(id);
          sessions.delete(id);
          void entry?.server.close().catch(() => undefined);
        };

        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      if (sessionId) {
        res.status(404).json({
          jsonrpc: "2.0",
          error: { code: -32001, message: "Session not found" },
          id: null,
        });
        return;
      }

      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: Mcp-Session-Id required (or send initialize)",
        },
        id: null,
      });
    } catch (error) {
      console.error("HTTP MCP request failed:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  if ((host === "0.0.0.0" || host === "::") && !token) {
    console.error(
      "Warning: binding to all interfaces without BRAIN_FIGHT_HTTP_TOKEN. " +
        "Anyone who can reach this port can call your MCP tools. Set a token before exposing publicly.",
    );
  }

  const httpServer: HttpServer = await new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => resolve(server));
    server.once("error", reject);
  });

  const address = httpServer.address();
  const actualPort =
    typeof address === "object" && address !== null ? address.port : port;

  // Prefer a client-friendly host in printed URLs.
  const urlHost = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
  const baseUrl = `http://${urlHost}:${actualPort}`;

  const close = async (): Promise<void> => {
    for (const [id, entry] of sessions) {
      sessions.delete(id);
      try {
        await entry.transport.close();
      } catch {
        // ignore
      }
      try {
        await entry.server.close();
      } catch {
        // ignore
      }
    }

    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });
  };

  return {
    host,
    port: actualPort,
    url: baseUrl,
    mcpUrl: `${baseUrl}/mcp`,
    close,
  };
}
