/**
 * Raw SQL DDL for the Brain Fight MCP database.
 * Kept as plain strings (rather than an ORM) to keep the dependency
 * footprint minimal, per the "zero LLM API calls / $0 cost" constraint.
 */

/**
 * Life-domain bucket for relationship state and track-record stats. Kept
 * as a small fixed set (not free text) so aggregation stays meaningful —
 * "general" is the catch-all for anything that doesn't fit, and is also
 * where pre-domain rows get migrated to.
 */
export const TOPIC_DOMAINS = [
  "career",
  "money",
  "relationships",
  "health",
  "general",
] as const;

export const CREATE_RELATIONSHIP_STATE_TABLE = `
CREATE TABLE IF NOT EXISTS relationship_state (
  session_id TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'general',
  angel_respect REAL DEFAULT 0.5,
  devil_respect REAL DEFAULT 0.5,
  angel_annoyance REAL DEFAULT 0.2,
  devil_annoyance REAL DEFAULT 0.2,
  cooperation REAL DEFAULT 0.3,
  recent_winner TEXT,
  total_conflicts INTEGER DEFAULT 0,
  PRIMARY KEY (session_id, domain)
);
`;

export const CREATE_CONFLICTS_TABLE = `
CREATE TABLE IF NOT EXISTS conflicts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'general',
  context TEXT NOT NULL,
  topic TEXT,
  angel_position TEXT NOT NULL,
  devil_position TEXT NOT NULL,
  winner TEXT,
  absurdity_level REAL DEFAULT 0.5,
  created_at INTEGER NOT NULL
);
`;

export const CREATE_CONFLICTS_SESSION_INDEX = `
CREATE INDEX IF NOT EXISTS idx_conflicts_session_created
  ON conflicts (session_id, created_at DESC);
`;

export const CREATE_CONFLICTS_SESSION_DOMAIN_INDEX = `
CREATE INDEX IF NOT EXISTS idx_conflicts_session_domain
  ON conflicts (session_id, domain, created_at DESC);
`;

/** In-progress turn-mode debates (one logical open conflict per session). */
export const CREATE_ACTIVE_CONFLICTS_TABLE = `
CREATE TABLE IF NOT EXISTS active_conflicts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'general',
  context TEXT NOT NULL,
  topic TEXT,
  intensity TEXT NOT NULL,
  core_disagreement TEXT NOT NULL,
  angel_json TEXT NOT NULL,
  devil_json TEXT NOT NULL,
  likely_winner TEXT,
  is_role_reversal INTEGER NOT NULL DEFAULT 0,
  absurdity_level REAL NOT NULL DEFAULT 0.5,
  continuity_json TEXT NOT NULL,
  brief_json TEXT,
  first_speaker TEXT NOT NULL,
  last_speaker TEXT,
  next_speaker TEXT NOT NULL,
  turn_index INTEGER NOT NULL DEFAULT 0,
  max_turns INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

/** Soft migration for DBs created before brief_json existed. */
export const MIGRATE_ACTIVE_CONFLICTS_BRIEF_JSON = `
ALTER TABLE active_conflicts ADD COLUMN brief_json TEXT;
`;

export const CREATE_ACTIVE_CONFLICTS_SESSION_INDEX = `
CREATE INDEX IF NOT EXISTS idx_active_conflicts_session_status
  ON active_conflicts (session_id, status, updated_at DESC);
`;

export const CREATE_DEBATE_TURNS_TABLE = `
CREATE TABLE IF NOT EXISTS debate_turns (
  id TEXT PRIMARY KEY,
  conflict_id TEXT NOT NULL,
  turn_index INTEGER NOT NULL,
  speaker TEXT NOT NULL,
  is_double_tap INTEGER NOT NULL DEFAULT 0,
  user_interjection TEXT,
  utterance TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conflict_id) REFERENCES active_conflicts(id) ON DELETE CASCADE
);
`;

export const CREATE_DEBATE_TURNS_CONFLICT_INDEX = `
CREATE INDEX IF NOT EXISTS idx_debate_turns_conflict
  ON debate_turns (conflict_id, turn_index ASC);
`;

/**
 * Follow-up outcomes: what the user actually did after a closed conflict,
 * and (optionally, reported later) how it went. This is what lets the
 * tool learn something across rounds instead of just performing a debate
 * and discarding the result. `domain` is denormalized from the parent
 * conflict at insert time so track-record stats can be grouped by domain
 * without a join.
 */
export const CREATE_DECISION_OUTCOMES_TABLE = `
CREATE TABLE IF NOT EXISTS decision_outcomes (
  id TEXT PRIMARY KEY,
  conflict_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'general',
  actual_choice TEXT NOT NULL,
  outcome_note TEXT,
  sentiment TEXT,
  recorded_at INTEGER NOT NULL,
  FOREIGN KEY (conflict_id) REFERENCES conflicts(id) ON DELETE CASCADE
);
`;

export const CREATE_DECISION_OUTCOMES_SESSION_INDEX = `
CREATE INDEX IF NOT EXISTS idx_decision_outcomes_session
  ON decision_outcomes (session_id, recorded_at DESC);
`;

export const CREATE_DECISION_OUTCOMES_SESSION_DOMAIN_INDEX = `
CREATE INDEX IF NOT EXISTS idx_decision_outcomes_session_domain
  ON decision_outcomes (session_id, domain, recorded_at DESC);
`;

export const ALL_SCHEMA_STATEMENTS = [
  CREATE_RELATIONSHIP_STATE_TABLE,
  CREATE_CONFLICTS_TABLE,
  CREATE_CONFLICTS_SESSION_INDEX,
  CREATE_CONFLICTS_SESSION_DOMAIN_INDEX,
  CREATE_ACTIVE_CONFLICTS_TABLE,
  CREATE_ACTIVE_CONFLICTS_SESSION_INDEX,
  CREATE_DEBATE_TURNS_TABLE,
  CREATE_DEBATE_TURNS_CONFLICT_INDEX,
  CREATE_DECISION_OUTCOMES_TABLE,
  CREATE_DECISION_OUTCOMES_SESSION_INDEX,
  CREATE_DECISION_OUTCOMES_SESSION_DOMAIN_INDEX,
];
