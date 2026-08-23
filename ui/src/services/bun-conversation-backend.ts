/**
 * Bun:sqlite implementation of NanoClaw ConversationBackend for the UI gateway.
 */
import fs from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";
import type { ConversationBackend } from "../../../nanoclaw/src/conversations/backend-types.ts";
import type {
  CallerContext,
  ConversationMessage,
  DeliveryAddress,
  SummarizeMessagesFn,
} from "../../../nanoclaw/src/conversations/types.ts";
import { HANDOFF_PREFIX, HISTORY_CUTOFF_KEY } from "../../../nanoclaw/src/conversations/types.ts";
import type { Session } from "../../../nanoclaw/src/types.ts";
import { INBOUND_SCHEMA, OUTBOUND_SCHEMA } from "../../../nanoclaw/src/db/schema.ts";

export interface BunConversationBackendConfig {
  dbPath: string;
  dataPath: string;
  nanoclawPath: string;
}

export async function createBunConversationBackend(
  config: BunConversationBackendConfig,
): Promise<ConversationBackend> {
  const centralDb = openCentralDb(config.dbPath);
  const schemas = { inbound: INBOUND_SCHEMA, outbound: OUTBOUND_SCHEMA };

  function sessionsBaseDir(): string {
    return path.join(config.dataPath, "v2-sessions");
  }

  function sessionDir(agentGroupId: string, sessionId: string): string {
    return path.join(sessionsBaseDir(), agentGroupId, sessionId);
  }

  function inboundDbPath(agentGroupId: string, sessionId: string): string {
    return path.join(sessionDir(agentGroupId, sessionId), "inbound.db");
  }

  function outboundDbPath(agentGroupId: string, sessionId: string): string {
    return path.join(sessionDir(agentGroupId, sessionId), "outbound.db");
  }

  function ensureSessionDbFile(dbPath: string, schemaSql: string): void {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const db = new Database(dbPath);
    db.run("PRAGMA journal_mode = DELETE");
    db.exec(schemaSql);
    db.close();
  }

  function initSessionFolder(agentGroupId: string, sessionId: string): void {
    const dir = sessionDir(agentGroupId, sessionId);
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(path.join(dir, "outbox"), { recursive: true });
    ensureSessionDbFile(inboundDbPath(agentGroupId, sessionId), schemas.inbound);
    ensureSessionDbFile(outboundDbPath(agentGroupId, sessionId), schemas.outbound);
  }

  function findUiConversationSession(agentGroupId: string, threadId: string): Session | undefined {
    return centralDb
      .query(
        `SELECT * FROM sessions
         WHERE agent_group_id = ?
           AND messaging_group_id IS NULL
           AND thread_id = ?
           AND status = 'active'
           AND thread_id NOT LIKE 'system:%'`,
      )
      .get(agentGroupId, threadId) as Session | undefined;
  }

  function createSessionRow(session: Session): void {
    centralDb.run(
      `INSERT INTO sessions (
        id, agent_group_id, messaging_group_id, thread_id, conversation_id,
        agent_provider, status, container_status, last_active, archived_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.agent_group_id,
        session.messaging_group_id,
        session.thread_id,
        session.conversation_id ?? null,
        session.agent_provider,
        session.status,
        session.container_status,
        session.last_active,
        session.archived_at ?? null,
        session.created_at,
      ],
    );
  }

  function archiveSessionRow(sessionId: string): void {
    const now = new Date().toISOString();
    centralDb.run(
      `UPDATE sessions SET status = 'archived', archived_at = ?, container_status = 'stopped' WHERE id = ?`,
      [now, sessionId],
    );
  }

  function generateSessionId(): string {
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function generateConversationId(): string {
    return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function createSessionInternal(ctx: CallerContext, opts?: { conversationId?: string }): Session {
    const id = generateSessionId();
    const conversationId = opts?.conversationId ?? generateConversationId();
    const session: Session = {
      id,
      agent_group_id: ctx.agentGroupId,
      messaging_group_id: ctx.messagingGroupId,
      thread_id: ctx.sessionMode === "per-thread" ? ctx.threadId : null,
      conversation_id: conversationId,
      agent_provider: null,
      status: "active",
      container_status: "stopped",
      last_active: null,
      archived_at: null,
      created_at: new Date().toISOString(),
    };
    createSessionRow(session);
    initSessionFolder(ctx.agentGroupId, id);
    return session;
  }

  function parseContentText(raw: string, role: "user" | "assistant"): string {
    if (role === "assistant") {
      return raw.replace(/<message[^>]*>/gi, "").replace(/<\/message>/gi, "").trim();
    }
    try {
      if (raw.startsWith("{")) {
        const parsed = JSON.parse(raw) as { text?: string; content?: string };
        return (parsed.text ?? parsed.content ?? raw).trim();
      }
    } catch {
      /* raw */
    }
    return raw.trim();
  }

  function getHistoryCutoff(agentGroupId: string, sessionId: string): string | null {
    const dbPath = outboundDbPath(agentGroupId, sessionId);
    if (!fs.existsSync(dbPath)) return null;
    const db = new Database(dbPath);
    try {
      const row = db
        .query("SELECT value FROM session_state WHERE key = ?")
        .get(HISTORY_CUTOFF_KEY) as { value: string } | undefined;
      return row?.value ?? null;
    } finally {
      db.close();
    }
  }

  function readConversationHistory(
    agentGroupId: string,
    sessionId: string,
    limit = 50,
  ): ConversationMessage[] {
    const inPath = inboundDbPath(agentGroupId, sessionId);
    const outPath = outboundDbPath(agentGroupId, sessionId);
    if (!fs.existsSync(inPath) && !fs.existsSync(outPath)) return [];

    const cutoff = getHistoryCutoff(agentGroupId, sessionId);
    const cutoffMs = cutoff ? Date.parse(cutoff) : null;
    const combined: ConversationMessage[] = [];

    if (fs.existsSync(inPath)) {
      const db = new Database(inPath);
      try {
        const rows = db
          .query("SELECT timestamp, content, kind FROM messages_in ORDER BY timestamp ASC")
          .all() as { timestamp: string; content: string; kind: string }[];
        for (const row of rows) {
          if (row.kind !== "chat" && row.kind !== "chat-sdk" && row.kind !== "system") continue;
          if (cutoffMs !== null && Number.isFinite(cutoffMs) && Date.parse(row.timestamp) <= cutoffMs) continue;
          combined.push({
            role: row.kind === "system" ? "system" : "user",
            text: parseContentText(row.content, "user"),
            timestamp: row.timestamp,
          });
        }
      } finally {
        db.close();
      }
    }

    if (fs.existsSync(outPath)) {
      const db = new Database(outPath, { readonly: true });
      try {
        const rows = db
          .query("SELECT timestamp, content FROM messages_out ORDER BY timestamp ASC")
          .all() as { timestamp: string; content: string }[];
        for (const row of rows) {
          if (cutoffMs !== null && Number.isFinite(cutoffMs) && Date.parse(row.timestamp) <= cutoffMs) continue;
          combined.push({
            role: "assistant",
            text: parseContentText(row.content, "assistant"),
            timestamp: row.timestamp,
          });
        }
      } finally {
        db.close();
      }
    }

    combined.sort((a, b) => {
      const tA = Date.parse(a.timestamp);
      const tB = Date.parse(b.timestamp);
      if (tA !== tB) return tA - tB;
      if (a.role === "user" && b.role === "assistant") return -1;
      if (a.role === "assistant" && b.role === "user") return 1;
      return 0;
    });

    return combined.slice(-limit);
  }

  function writeInboundMessage(
    agentGroupId: string,
    sessionId: string,
    row: {
      id: string;
      kind: string;
      timestamp: string;
      channelType: string | null;
      threadId: string | null;
      content: string;
    },
  ): void {
    const db = new Database(inboundDbPath(agentGroupId, sessionId));
    try {
      db.run(
        `INSERT INTO messages_in (id, timestamp, kind, channel_type, thread_id, content) VALUES (?, ?, ?, ?, ?, ?)`,
        [row.id, row.timestamp, row.kind, row.channelType, row.threadId, row.content],
      );
    } finally {
      db.close();
    }
  }

  const backend: ConversationBackend = {
    resolveActiveSession(ctx: CallerContext) {
      if (ctx.sessionMode === "per-thread" && ctx.threadId) {
        const existing = findUiConversationSession(ctx.agentGroupId, ctx.threadId);
        if (existing) return { session: existing, created: false };
      }
      const session = createSessionInternal(ctx);
      return { session, created: true };
    },

    archiveSession(session: Session) {
      archiveSessionRow(session.id);
    },

    forgetSoft(agentGroupId: string, sessionId: string) {
      const dbPath = outboundDbPath(agentGroupId, sessionId);
      if (!fs.existsSync(dbPath)) return;
      const db = new Database(dbPath);
      try {
        db.run("DELETE FROM session_state WHERE key LIKE 'continuation:%'");
        db.run("DELETE FROM session_state WHERE key = 'sdk_session_id'");
        const now = new Date().toISOString();
        db.run(
          "INSERT OR REPLACE INTO session_state (key, value, updated_at) VALUES (?, ?, ?)",
          [HISTORY_CUTOFF_KEY, now, now],
        );
      } finally {
        db.close();
      }
    },

    createConversationSession(ctx: CallerContext, opts?: { conversationId?: string }) {
      return createSessionInternal(ctx, opts);
    },

    startNewConversation(ctx: CallerContext, current: Session, opts?: { handoffText?: string }) {
      backend.archiveSession(current);
      const next = createSessionInternal(ctx);
      if (opts?.handoffText) {
        writeInboundMessage(ctx.agentGroupId, next.id, {
          id: `handoff-${Date.now()}`,
          kind: "chat",
          timestamp: new Date().toISOString(),
          channelType: ctx.channelType,
          threadId: ctx.threadId,
          content: JSON.stringify({
            text: `${HANDOFF_PREFIX}\n${opts.handoffText}`,
            sender: "system",
            conversation_handoff: true,
          }),
        });
      }
      return next;
    },

    async startNewConversationWithResume(
      ctx: CallerContext,
      current: Session,
      summarizeWithLlm?: SummarizeMessagesFn,
    ) {
      const history = readConversationHistory(ctx.agentGroupId, current.id, 50);
      const summarizerPath = path.join(config.nanoclawPath, "src", "conversations", "summarizer.js");
      const { summarizeConversation } = await import(summarizerPath);
      const summary = await summarizeConversation(history, summarizeWithLlm);
      const session = backend.startNewConversation(ctx, current, { handoffText: summary });
      return { session, summary };
    },

    readConversationHistory(agentGroupId: string, sessionId: string, limit = 50) {
      return readConversationHistory(agentGroupId, sessionId, limit);
    },

    initSessionFolder(agentGroupId: string, sessionId: string) {
      initSessionFolder(agentGroupId, sessionId);
    },

    inboundDbPath(agentGroupId: string, sessionId: string) {
      return inboundDbPath(agentGroupId, sessionId);
    },

    outboundDbPath(agentGroupId: string, sessionId: string) {
      return outboundDbPath(agentGroupId, sessionId);
    },

    writeCommandAck(agentGroupId: string, sessionId: string, delivery: DeliveryAddress, text: string) {
      const dbPath = outboundDbPath(agentGroupId, sessionId);
      if (!fs.existsSync(dbPath)) return;
      const db = new Database(dbPath);
      try {
        const id = `cmd-ack-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const ts = new Date().toISOString();
        db.run(
          `INSERT OR IGNORE INTO messages_out (id, seq, timestamp, kind, platform_id, channel_type, thread_id, content)
           VALUES (?, (SELECT COALESCE(MAX(seq), 0) + 2 FROM messages_out), ?, ?, ?, ?, ?, ?)`,
          [
            id,
            ts,
            "chat",
            delivery.platformId,
            delivery.channelType,
            delivery.threadId,
            JSON.stringify({ text, sender: "system", command_ack: true, ephemeral: false }),
          ],
        );
      } finally {
        db.close();
      }
    },
  };

  return backend;
}

function openCentralDb(dbPath: string): Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");

  const hasSchema =
    tableExists(db, "schema_version") || tableExists(db, "agent_groups");
  if (!hasSchema) {
    throw new Error(
      "Banco central do NanoClaw não encontrado. Inicie o host NanoClaw (Node) ou rode o setup antes de usar o app Mac.",
    );
  }
  return db;
}

function tableExists(db: Database, name: string): boolean {
  const row = db
    .query("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .get(name) as { ok: number } | null;
  return row?.ok === 1;
}

