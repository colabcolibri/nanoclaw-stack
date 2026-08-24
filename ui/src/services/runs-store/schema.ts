/**
 * DDL portável — funciona em SQLite e MySQL com ajuste mínimo de driver.
 * MySQL: trocar INSERT OR REPLACE por INSERT ... ON DUPLICATE KEY UPDATE.
 */

export const RUNS_INDEX_DDL = `
CREATE TABLE IF NOT EXISTS runs_index (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_db TEXT NOT NULL,
  kind TEXT NOT NULL,
  category TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  model TEXT,
  tokens INTEGER,
  cost_brl REAL,
  latency_ms INTEGER,
  message_id TEXT,
  search_text TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_runs_index_ts ON runs_index(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_runs_index_kind_ts ON runs_index(kind, timestamp DESC);

CREATE TABLE IF NOT EXISTS runs_sync_state (
  source_key TEXT PRIMARY KEY,
  source_mtime_ms INTEGER NOT NULL,
  row_count INTEGER NOT NULL,
  synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs_index_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export const AGENT_AUDIT_DDL = `
CREATE TABLE IF NOT EXISTS agent_audit (
  id TEXT PRIMARY KEY,
  step TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  purpose TEXT NOT NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  agent TEXT,
  department TEXT,
  message_id TEXT,
  supervisor_step INTEGER,
  decision TEXT,
  prompt_preview TEXT,
  response_preview TEXT,
  metadata_json TEXT,
  tokens_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_ts ON agent_audit(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_audit_step ON agent_audit(step);
`;
