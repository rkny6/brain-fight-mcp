import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSummonAngelTool } from "../mcp/tools/summonAngel.js";
import { registerSummonDevilTool } from "../mcp/tools/summonDevil.js";
import { registerStartConflictTool } from "../mcp/tools/startConflict.js";
import { registerGetRelationshipTool } from "../mcp/tools/getRelationship.js";
import { registerResetRelationshipTool } from "../mcp/tools/resetRelationship.js";
import { registerAngelProfileResource } from "../mcp/resources/angelProfile.js";
import { registerDevilProfileResource } from "../mcp/resources/devilProfile.js";
import { registerRelationshipStateResource } from "../mcp/resources/relationshipState.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "angel-devil-mcp",
    version: "0.1.0",
  });

  // Tools
  registerSummonAngelTool(server);
  registerSummonDevilTool(server);
  registerStartConflictTool(server);
  registerGetRelationshipTool(server);
  registerResetRelationshipTool(server);

  // Resources
  registerAngelProfileResource(server);
  registerDevilProfileResource(server);
  registerRelationshipStateResource(server);

  return server;
}
