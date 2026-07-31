import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getDb } from "./db/database.js";
import { createServer } from "./server/createServer.js";
import { parseCliArgs, printHelp } from "./server/cli.js";
import { startHttpServer } from "./server/httpServer.js";

async function main(): Promise<void> {
  let options;
  try {
    options = parseCliArgs();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    printHelp();
    process.exit(1);
  }

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  // Initialize the SQLite database (creates tables if they don't exist yet).
  getDb();

  if (options.mode === "http") {
    const started = await startHttpServer({
      host: options.host,
      port: options.port,
      token: options.token,
      allowedHosts: options.allowedHosts,
    });

    console.error(`Brain Fight MCP server running on Streamable HTTP.`);
    console.error(`  Health: ${started.url}/health`);
    console.error(`  MCP:    ${started.mcpUrl}`);
    if (options.token) {
      console.error(`  Auth:   Authorization: Bearer <token>  (or ?token=)`);
    } else {
      console.error(
        `  Auth:   none (set --token / BRAIN_FIGHT_HTTP_TOKEN before public exposure)`,
      );
    }
    console.error(`  Tunnel tip: cloudflared tunnel --url ${started.url}`);

    const shutdown = async (signal: string) => {
      console.error(`Received ${signal}, shutting down HTTP server...`);
      try {
        await started.close();
      } finally {
        process.exit(0);
      }
    };

    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.once("SIGTERM", () => void shutdown("SIGTERM"));
    return;
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // MCP stdio servers must never write non-protocol output to stdout,
  // since stdout is the JSON-RPC channel. Log startup info to stderr.
  console.error("Brain Fight MCP server running on stdio.");
}

main().catch((error) => {
  console.error("Fatal error starting Brain Fight MCP server:", error);
  process.exit(1);
});
