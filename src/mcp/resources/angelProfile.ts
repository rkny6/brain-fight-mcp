import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getProfile } from "../../db/repositories/profileRepository.js";

export function registerAngelProfileResource(server: McpServer): void {
  server.resource(
    "angel-profile",
    "angel://profile",
    { description: "Static personality profile for Angel.", mimeType: "application/json" },
    async (uri) => {
      const profile = getProfile("angel");
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(profile, null, 2),
          },
        ],
      };
    }
  );
}
