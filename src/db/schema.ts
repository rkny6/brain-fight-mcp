/**
 * Raw SQL DDL for the Angel & Devil MCP database.
 * Kept as plain strings (rather than an ORM) to keep the dependency
 * footprint minimal, per the "zero LLM API calls / $0 cost" constraint.
 */

export const CREATE_RELATIONSHIP_STATE_TABLE = `
CREATE TABLE IF NOT EXISTS relationship_state (
  session_id TEXT PRIMARY KEY,
  angel_respect REAL DEFAULT 0.5,
  devil_respect REAL DEFAULT 0.5,
  angel_annoyance REAL DEFAULT 0.2,
  devil_annoyance REAL DEFAULT 0.2,
  cooperation REAL DEFAULT 0.3,
  recent_winner TEXT,
  total_conflicts INTEGER DEFAULT 0
);
`;

export const CREATE_CONFLICTS_TABLE = `
CREATE TABLE IF NOT EXISTS conflicts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
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

export const ALL_SCHEMA_STATEMENTS = [
  CREATE_RELATIONSHIP_STATE_TABLE,
  CREATE_CONFLICTS_TABLE,
  CREATE_CONFLICTS_SESSION_INDEX,
];
