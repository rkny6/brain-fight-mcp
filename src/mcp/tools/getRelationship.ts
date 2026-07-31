import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  DEFAULT_TOPIC_DOMAIN,
  GetRelationshipInputSchema,
  TopicDomainSchema,
} from "../../types/index.js";
import {
  getAllRelationshipsForSession,
  getOrCreateRelationship,
} from "../../db/repositories/relationshipRepository.js";
import { recall, recallOutcomes, buildTrackRecord } from "../../core/memoryEngine.js";
import { getAllMilestones } from "../../db/repositories/milestoneRepository.js";

const InputShape = {
  sessionId: z.string().default("default").describe("Session/project identifier for state isolation."),
  domain: TopicDomainSchema.optional().describe(
    "Look up just this domain's relationship/track record (career | money | relationships | health | general). Omit to also get an all-domains summary alongside the default bucket.",
  ),
};

export function registerGetRelationshipTool(server: McpServer): void {
  server.tool(
    "get_relationship",
    "Returns the current Angel/Devil relationship state (respect, annoyance, cooperation), recent conflict history, and a track record of recorded real-world outcomes — scoped to one domain if given, otherwise the 'general' bucket plus a cross-domain summary.",
    InputShape,
    async (rawInput) => {
      const input = GetRelationshipInputSchema.parse(rawInput);
      const domain = input.domain ?? DEFAULT_TOPIC_DOMAIN;

      const relationship = getOrCreateRelationship(input.sessionId, domain);
      const recentMemory = recall(input.sessionId, 5, domain);
      const recentOutcomes = recallOutcomes(input.sessionId, 20, domain);
      const trackRecord = buildTrackRecord(recentOutcomes);

      // When the caller didn't pin a domain, also surface what every
      // domain bucket looks like so a genuinely cross-cutting question
      // ("how are we doing overall?") isn't stuck reading only 'general'.
      const allDomainsSummary = input.domain
        ? undefined
        : getAllRelationshipsForSession(input.sessionId).map((r) => ({
            domain: r.domain,
            angelRespect: r.angelRespect,
            devilRespect: r.devilRespect,
            cooperation: r.cooperation,
            totalConflicts: r.totalConflicts,
            recentWinner: r.recentWinner,
          }));

      const milestones = getAllMilestones(input.sessionId, input.domain);

      const result = {
        domain,
        relationship,
        recent_memory: recentMemory,
        recent_outcomes: recentOutcomes,
        track_record: trackRecord,
        milestones_reached: milestones,
        all_domains_summary: allDomainsSummary,
        performance_instructions:
          "If the user is asking about the relationship out of curiosity, describe it in-character — Angel and Devil can briefly comment on their own dynamic (e.g. grudging respect, simmering annoyance, surprising cooperation) rather than reading out raw numbers. If track_record has recorded outcomes, you may casually reference the pattern (e.g. 'the last few times you sided with Devil on spending, it went well twice and stung once') — only if it's actually relevant to what the user asked, not as a forced callback. If all_domains_summary is present and the user's question is genuinely about their overall patterns (not one specific domain), you may mention how domains differ (e.g. 'we argue a lot about money, barely ever about health'). If milestones_reached is non-empty and the user is asking out of genuine curiosity, you may mention one or two as flavor — but these were already announced in-character when they first happened, so don't re-stage them as new news here.",
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
