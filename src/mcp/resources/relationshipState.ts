import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getOrCreateRelationship } from "../../db/repositories/relationshipRepository.js";

/**
 * Exposes the live relationship state as a resource.
 * `relationship://state` (no session segment) defaults to the "default" session.
 * `relationship://state/{sessionId}` reads a specific session's state.
 */
export function registerRelationshipStateResource(server: McpServer): void {
  server.resource(
    "relationship-state",
    new ResourceTemplate("relationship://state/{sessionId}", {
      list: undefined,
    }),
    { description: "Live Angel/Devil relationship state for a session.", mimeType: "application/json" },
    async (uri, { sessionId }) => {
      const resolvedSessionId =
        (Array.isArray(sessionId) ? sessionId[0] : sessionId) || "default";
      const state = getOrCreateRelationship(resolvedSessionId);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(state, null, 2),
          },
        ],
      };
    }
  );

  // Convenience static alias for the default session.
  server.resource(
    "relationship-state-default",
    "relationship://state",
    { description: "Live Angel/Devil relationship state for the default session.", mimeType: "application/json" },
    async (uri) => {
      const state = getOrCreateRelationship("default");
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(state, null, 2),
          },
        ],
      };
    }
  );
}
