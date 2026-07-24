import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getDb } from "./db/database.js";
import { createServer } from "./server/createServer.js";

async function main(): Promise<void> {
  // Initialize the SQLite database (creates tables if they don't exist yet).
  getDb();

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // MCP stdio servers must never write non-protocol output to stdout,
  // since stdout is the JSON-RPC channel. Log startup info to stderr.
  console.error("Angel & Devil MCP server running on stdio.");
}

main().catch((error) => {
  console.error("Fatal error starting Angel & Devil MCP server:", error);
  process.exit(1);
});
