import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getProfile } from "../../db/repositories/profileRepository.js";

export function registerDevilProfileResource(server: McpServer): void {
  server.resource(
    "devil-profile",
    "devil://profile",
    { description: "Static personality profile for Devil.", mimeType: "application/json" },
    async (uri) => {
      const profile = getProfile("devil");
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
