/**
 * SQL operations on per-session inbound/outbound DBs.
 *
 * These are NOT the central app DB — they're the cross-mount SQLite files
 * shared between host and container. Callers own the connection lifecycle
 * (open-write-close per op). See session-manager.ts header for invariants.
 */
import { INBOUND_SCHEMA, OUTBOUND_SCHEMA } from './schema.js';
import { openSqliteDatabase, runSqliteTransaction, sqliteChanges, type SqliteDatabase } from './sqlite-compat.js';

type SessionDbMode = 'inbound' | 'outbound-readonly' | 'outbound-rw';

function applySessionDbPragmas(db: SqliteDatabase, mode: SessionDbMode): void {
  if (mode !== 'outbound-readonly') {
    db.pragma('journal_mode = DELETE');
  }
  db.pragma('busy_timeout = 5000');
}

/** Apply the inbound or outbound schema to a DB file. Idempotent. */
export function ensureSchema(dbPath: string, schema: 'inbound' | 'outbound'): void {
  const db = openSqliteDatabase(dbPath);
  db.pragma('journal_mode = DELETE');
  db.exec(schema === 'inbound' ? INBOUND_SCHEMA : OUTBOUND_SCHEMA);
  db.close();
}

/** Open the inbound DB for a session (host reads/writes). */
export function openInboundDb(dbPath: string): SqliteDatabase {
  const db = openSqliteDatabase(dbPath);
  applySessionDbPragmas(db, 'inbound');
  return db;
}

/** Open the outbound DB for a session (host reads only). */
export function openOutboundDb(dbPath: string): SqliteDatabase {
  const db = openSqliteDatabase(dbPath, { readonly: true });
  applySessionDbPragmas(db, 'outbound-readonly');
  return db;
}

/** Open the outbound DB for a session with write access. Only safe to call when no container is running. */
export function openOutboundDbRw(dbPath: string): SqliteDatabase {
  const db = openSqliteDatabase(dbPath);
  applySessionDbPragmas(db, 'outbound-rw');
  return db;
}

export function upsertSessionRouting(
  db: SqliteDatabase,
  routing: { channel_type: string | null; platform_id: string | null; thread_id: string | null },
): void {
  db.prepare(
    `INSERT INTO session_routing (id, channel_type, platform_id, thread_id)
     VALUES (1, @channel_type, @platform_id, @thread_id)
     ON CONFLICT(id) DO UPDATE SET
       channel_type = excluded.channel_type,
       platform_id  = excluded.platform_id,
       thread_id    = excluded.thread_id`,
  ).run(routing);
}

export interface DestinationRow {
  name: string;
  display_name: string | null;
  type: 'channel' | 'agent';
  channel_type: string | null;
  platform_id: string | null;
  agent_group_id: string | null;
}

export function replaceDestinations(db: SqliteDatabase, entries: DestinationRow[]): void {
  runSqliteTransaction(db, (rows: DestinationRow[]) => {
    db.prepare('DELETE FROM destinations').run();
    const stmt = db.prepare(
      `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
       VALUES (@name, @display_name, @type, @channel_type, @platform_id, @agent_group_id)`,
    );
    for (const row of rows) stmt.run(row);
  }, entries);
}

// ---------------------------------------------------------------------------
// messages_in
// ---------------------------------------------------------------------------

/**
 * Next even seq number for host-owned inbound.db.
 *
 * Exported so the scheduling module's task helpers can maintain the
 * host-writes-even-seq invariant without duplicating the logic. Not part of
 * the general public API — imported by `src/modules/scheduling/db.ts` only.
 */
export function nextEvenSeq(db: SqliteDatabase): number {
  const maxSeq = (db.prepare('SELECT COALESCE(MAX(seq), 0) AS m FROM messages_in').get() as { m: number }).m;
  return maxSeq < 2 ? 2 : maxSeq + 2 - (maxSeq % 2);
}

export function insertMessage(
  db: SqliteDatabase,
  message: {
    id: string;
    kind: string;
    timestamp: string;
    platformId: string | null;
    channelType: string | null;
    threadId: string | null;
    content: string;
    processAfter: string | null;
    recurrence: string | null;
    /**
     * 1 = wake the agent (default); 0 = accumulate as context only.
     * Host countDueMessages gates on this; container reads everything.
     */
    trigger?: 0 | 1;
    /**
     * For agent-to-agent inbound: the source session id that emitted the
     * outbound message which became this inbound row. Used as the return
     * path for the target's reply. NULL on channel-side inbound.
     */
    sourceSessionId?: string | null;
    /**
     * 1 = only deliver on the container's first poll (fresh start).
     * Dying containers (past first poll) skip these rows.
     */
    onWake?: 0 | 1;
    memo?: string | null;
  },
): void {
  let memoText = message.memo;
  if (!memoText) {
    let clean = message.content;
    try {
      const parsed = JSON.parse(message.content);
      clean = parsed.text || message.content;
    } catch {}
    clean = clean.replace(/<message\s+to="[^"]*">/gi, '').replace(/<\/message>/gi, '').replace(/\s+/g, ' ').trim();
    memoText = clean.length <= 450 ? clean : `${clean.slice(0, 447)}...`;
  }

  db.prepare(
    `INSERT INTO messages_in (id, seq, kind, timestamp, status, platform_id, channel_type, thread_id, content, process_after, recurrence, series_id, trigger, source_session_id, on_wake, memo)
     VALUES (@id, @seq, @kind, @timestamp, 'pending', @platformId, @channelType, @threadId, @content, @processAfter, @recurrence, @id, @trigger, @sourceSessionId, @onWake, @memo)`,
  ).run({
    ...message,
    memo: memoText,
    trigger: message.trigger ?? 1,
    onWake: message.onWake ?? 0,
    sourceSessionId: message.sourceSessionId ?? null,
    seq: nextEvenSeq(db),
  });
}

export function countDueMessages(db: SqliteDatabase): number {
  return (
    db
      .prepare(
        `SELECT COUNT(*) as count FROM messages_in
       WHERE status = 'pending'
         AND trigger = 1
         AND (process_after IS NULL OR datetime(process_after) <= datetime('now'))`,
      )
      .get() as { count: number }
  ).count;
}

export function markMessageFailed(db: SqliteDatabase, messageId: string): void {
  db.prepare("UPDATE messages_in SET status = 'failed' WHERE id = ?").run(messageId);
}

export function retryWithBackoff(db: SqliteDatabase, messageId: string, backoffSec: number): void {
  const processAfter = new Date(Date.now() + backoffSec * 1000).toISOString();
  db.prepare('UPDATE messages_in SET tries = tries + 1, process_after = ? WHERE id = ?').run(processAfter, messageId);
}

export function getMessageForRetry(
  db: SqliteDatabase,
  messageId: string,
  status: string,
): { id: string; tries: number; processAfter: string | null } | undefined {
  return db
    .prepare('SELECT id, tries, process_after as processAfter FROM messages_in WHERE id = ? AND status = ?')
    .get(messageId, status) as { id: string; tries: number; processAfter: string | null } | undefined;
}

export function syncProcessingAcks(inDb: SqliteDatabase, outDb: SqliteDatabase): void {
  const completed = outDb
    .prepare(
      "SELECT message_id, status FROM processing_ack WHERE status IN ('completed', 'failed', 'script-skip:error')",
    )
    .all() as Array<{ message_id: string; status: string }>;

  if (completed.length === 0) return;

  // `script-skip:error` (pre-task script crashed) lands as a FAILED run —
  // semantically true, and it lets recurrence derive the trailing failed
  // streak from the occurrence rows themselves (no stored counter).
  const completeStmt = inDb.prepare(
    "UPDATE messages_in SET status = 'completed' WHERE id = ? AND status NOT IN ('completed', 'failed')",
  );
  const failStmt = inDb.prepare(
    "UPDATE messages_in SET status = 'failed' WHERE id = ? AND status NOT IN ('completed', 'failed')",
  );
  runSqliteTransaction(inDb, () => {
    for (const { message_id, status } of completed) {
      (status === 'script-skip:error' ? failStmt : completeStmt).run(message_id);
    }
  });
}

export interface ProcessingClaim {
  message_id: string;
  status_changed: string;
}

/** Return processing_ack rows still in 'processing' with their claim timestamps. */
export function getProcessingClaims(outDb: SqliteDatabase): ProcessingClaim[] {
  return outDb
    .prepare("SELECT message_id, status_changed FROM processing_ack WHERE status = 'processing'")
    .all() as ProcessingClaim[];
}

/**
 * Delete orphan 'processing' rows. Called by the host after killing a
 * container so the leftover claim doesn't trip claim-stuck on the next sweep
 * tick (which would kill the freshly respawned container before its
 * agent-runner can run its own startup cleanup).
 *
 * Safe because the host only writes to outbound.db when no container is
 * running (we just killed it). Returns the number of rows deleted.
 */
export function deleteOrphanProcessingClaims(outDb: SqliteDatabase): number {
  return sqliteChanges(outDb.prepare("DELETE FROM processing_ack WHERE status = 'processing'").run());
}

export interface ContainerState {
  current_tool: string | null;
  tool_declared_timeout_ms: number | null;
  tool_started_at: string | null;
}

/**
 * Read the container's current tool-in-flight state, if any. Returns null
 * when either the table doesn't exist yet (older session DB) or no tool is
 * active. Host sweep reads this to widen stuck-detection tolerance while
 * Bash is running with a long declared timeout.
 */
export function getContainerState(outDb: SqliteDatabase): ContainerState | null {
  try {
    const row = outDb
      .prepare(
        `SELECT current_tool, tool_declared_timeout_ms, tool_started_at
           FROM container_state WHERE id = 1`,
      )
      .get() as ContainerState | undefined;
    return row ?? null;
  } catch {
    // Table not present on older session DBs — treat as "no tool in flight".
    return null;
  }
}

// ---------------------------------------------------------------------------
// messages_out (read-only from host)
// ---------------------------------------------------------------------------

export interface OutboundMessage {
  id: string;
  kind: string;
  platform_id: string | null;
  channel_type: string | null;
  thread_id: string | null;
  content: string;
  in_reply_to: string | null;
}

export function getDueOutboundMessages(db: SqliteDatabase): OutboundMessage[] {
  return db
    .prepare(
      `SELECT * FROM messages_out
       WHERE (deliver_after IS NULL OR datetime(deliver_after) <= datetime('now'))
       ORDER BY timestamp ASC`,
    )
    .all() as OutboundMessage[];
}

// ---------------------------------------------------------------------------
// delivered
// ---------------------------------------------------------------------------

export function getDeliveredIds(db: SqliteDatabase): Set<string> {
  return new Set(
    (db.prepare('SELECT message_out_id FROM delivered').all() as Array<{ message_out_id: string }>).map(
      (r) => r.message_out_id,
    ),
  );
}

export function markDelivered(db: SqliteDatabase, messageOutId: string, platformMessageId: string | null): void {
  db.prepare(
    "INSERT OR IGNORE INTO delivered (message_out_id, platform_message_id, status, delivered_at) VALUES (?, ?, 'delivered', ?)",
  ).run(messageOutId, platformMessageId ?? null, new Date().toISOString());
}

export function markDeliveryFailed(db: SqliteDatabase, messageOutId: string): void {
  db.prepare(
    "INSERT OR IGNORE INTO delivered (message_out_id, platform_message_id, status, delivered_at) VALUES (?, NULL, 'failed', ?)",
  ).run(messageOutId, new Date().toISOString());
}

/** Ensure the delivered table has columns added after initial schema. */
export function migrateDeliveredTable(db: SqliteDatabase): void {
  const cols = new Set(
    (db.prepare("PRAGMA table_info('delivered')").all() as Array<{ name: string }>).map((c) => c.name),
  );
  if (!cols.has('platform_message_id')) {
    db.prepare('ALTER TABLE delivered ADD COLUMN platform_message_id TEXT').run();
  }
  if (!cols.has('status')) {
    db.prepare("ALTER TABLE delivered ADD COLUMN status TEXT NOT NULL DEFAULT 'delivered'").run();
  }
}

// LEGACY-COMPAT(v1-tasks): adds columns added to messages_in after the initial
// v2 schema to pre-existing session DBs — this lazy, on-open migration IS the
// upgrade path for old installs (there is no central migration for session
// DBs). No-op on fresh installs where the columns are in the baseline schema.
// Backfills existing rows so invariants hold (series_id = id).
export function migrateMessagesInTable(db: SqliteDatabase): void {
  const cols = new Set(
    (db.prepare("PRAGMA table_info('messages_in')").all() as Array<{ name: string }>).map((c) => c.name),
  );
  if (!cols.has('series_id')) {
    db.prepare('ALTER TABLE messages_in ADD COLUMN series_id TEXT').run();
    db.prepare('UPDATE messages_in SET series_id = id WHERE series_id IS NULL').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_messages_in_series ON messages_in(series_id)').run();
  }
  if (!cols.has('trigger')) {
    // All pre-existing rows got written with the old "every inbound wakes
    // the agent" semantics, so backfill 1 and default 1 for new inserts.
    db.prepare('ALTER TABLE messages_in ADD COLUMN trigger INTEGER NOT NULL DEFAULT 1').run();
  }
  if (!cols.has('source_session_id')) {
    // For agent-to-agent return-path routing. NULL on existing rows is fine —
    // their replies fall back to the legacy "newest active session" lookup.
    db.prepare('ALTER TABLE messages_in ADD COLUMN source_session_id TEXT').run();
  }
  if (!cols.has('on_wake')) {
    // 1 = only deliver on the container's first poll (fresh start).
    // All existing rows are normal messages, so default 0.
    db.prepare('ALTER TABLE messages_in ADD COLUMN on_wake INTEGER NOT NULL DEFAULT 0').run();
  }
}

/**
 * Look up an inbound row's source_session_id by its message id. Returns null
 * if the row doesn't exist or the column is NULL (channel inbound or
 * pre-migration a2a inbound). Used by a2a routing to route replies back to
 * the originating session.
 */
export function getInboundSourceSessionId(db: SqliteDatabase, messageId: string): string | null {
  const row = db.prepare('SELECT source_session_id FROM messages_in WHERE id = ?').get(messageId) as
    | { source_session_id: string | null }
    | undefined;
  return row?.source_session_id ?? null;
}

/**
 * Find the source_session_id of the most recent a2a inbound row from a
 * specific peer (by agent group id). Used as a peer-affinity fallback in
 * a2a routing when an outbound reply has no `in_reply_to` (e.g. the
 * container's send_message MCP tool path didn't thread the batch's
 * in_reply_to through).
 *
 * Heuristic: "the last time this peer talked to me, which session was it?"
 * Returns null when no prior a2a inbound from that peer carries a
 * non-null source_session_id (typical for pre-migration installs).
 */
export function getMostRecentPeerSourceSessionId(db: SqliteDatabase, peerAgentGroupId: string): string | null {
  const row = db
    .prepare(
      `SELECT source_session_id FROM messages_in
        WHERE channel_type = 'agent'
          AND platform_id = ?
          AND source_session_id IS NOT NULL
        ORDER BY seq DESC
        LIMIT 1`,
    )
    .get(peerAgentGroupId) as { source_session_id: string | null } | undefined;
  return row?.source_session_id ?? null;
}
