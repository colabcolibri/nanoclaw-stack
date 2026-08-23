import fs from 'fs';

import { openOutboundDbRw } from '../db/session-db.js';
import { outboundDbPath } from '../session-manager.js';
import { HISTORY_CUTOFF_KEY } from './types.js';

const CONTINUATION_PREFIX = 'continuation:';

/** Remove all provider continuation tokens for a session (soft forget). */
export function clearAllContinuations(agentGroupId: string, sessionId: string): void {
  const dbPath = outboundDbPath(agentGroupId, sessionId);
  const db = openOutboundDbRw(dbPath);
  try {
    db.prepare(`DELETE FROM session_state WHERE key LIKE ?`).run(`${CONTINUATION_PREFIX}%`);
    db.prepare(`DELETE FROM session_state WHERE key = ?`).run('sdk_session_id');
  } finally {
    db.close();
  }
}

/** Mark a timestamp after which inbound/outbound history is ignored (soft forget for gateway). */
export function setHistoryCutoff(agentGroupId: string, sessionId: string, isoTimestamp: string): void {
  const dbPath = outboundDbPath(agentGroupId, sessionId);
  const db = openOutboundDbRw(dbPath);
  try {
    db.prepare(
      `INSERT OR REPLACE INTO session_state (key, value, updated_at) VALUES (?, ?, ?)`,
    ).run(HISTORY_CUTOFF_KEY, isoTimestamp, isoTimestamp);
  } finally {
    db.close();
  }
}

/** Read history cutoff if set. */
export function getHistoryCutoff(agentGroupId: string, sessionId: string): string | null {
  const dbPath = outboundDbPath(agentGroupId, sessionId);
  if (!fs.existsSync(dbPath)) return null;
  const db = openOutboundDbRw(dbPath);
  try {
    const row = db.prepare(`SELECT value FROM session_state WHERE key = ?`).get(HISTORY_CUTOFF_KEY) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  } finally {
    db.close();
  }
}
