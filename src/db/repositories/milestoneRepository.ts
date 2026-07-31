import { getDb } from "../database.js";
import type { MilestoneKey, RelationshipMilestone, TopicDomain } from "../../types/index.js";

interface MilestoneRow {
  session_id: string;
  domain: string;
  milestone_key: string;
  reached_at: number;
}

function rowToRecord(row: MilestoneRow): RelationshipMilestone {
  return {
    sessionId: row.session_id,
    domain: row.domain as TopicDomain,
    key: row.milestone_key as MilestoneKey,
    reachedAt: row.reached_at,
  };
}

/** All milestone keys already fired for this (session, domain), as a Set for cheap membership checks. */
export function getReachedMilestoneKeys(
  sessionId: string,
  domain: TopicDomain,
): Set<MilestoneKey> {
  const db = getDb();
  const rows = db
    .prepare<[string, string], { milestone_key: string }>(
      "SELECT milestone_key FROM relationship_milestones WHERE session_id = ? AND domain = ?",
    )
    .all(sessionId, domain);
  return new Set(rows.map((r) => r.milestone_key as MilestoneKey));
}

/** Every milestone ever reached for this session, across all domains (or scoped to one). */
export function getAllMilestones(
  sessionId: string,
  domain?: TopicDomain,
): RelationshipMilestone[] {
  const db = getDb();
  if (domain) {
    const rows = db
      .prepare<[string, string], MilestoneRow>(
        "SELECT * FROM relationship_milestones WHERE session_id = ? AND domain = ? ORDER BY reached_at ASC",
      )
      .all(sessionId, domain);
    return rows.map(rowToRecord);
  }
  const rows = db
    .prepare<[string], MilestoneRow>(
      "SELECT * FROM relationship_milestones WHERE session_id = ? ORDER BY reached_at ASC",
    )
    .all(sessionId);
  return rows.map(rowToRecord);
}

/**
 * Records a milestone as reached. Idempotent by design (PK is
 * session_id+domain+milestone_key) — safe to call even if it somehow got
 * detected twice in one process.
 */
export function recordMilestone(
  sessionId: string,
  domain: TopicDomain,
  key: MilestoneKey,
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO relationship_milestones (session_id, domain, milestone_key, reached_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(session_id, domain, milestone_key) DO NOTHING`,
  ).run(sessionId, domain, key, Date.now());
}

/** Deletes milestone records for a session. Pass a domain to scope it. */
export function deleteMilestones(sessionId: string, domain?: TopicDomain): void {
  const db = getDb();
  if (domain) {
    db.prepare(
      "DELETE FROM relationship_milestones WHERE session_id = ? AND domain = ?",
    ).run(sessionId, domain);
  } else {
    db.prepare("DELETE FROM relationship_milestones WHERE session_id = ?").run(
      sessionId,
    );
  }
}
