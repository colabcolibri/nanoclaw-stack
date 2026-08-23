/**
 * Bun-native conversation + session bridge for the UI server.
 * The NanoClaw host uses better-sqlite3 (Node); the UI runs on Bun and must not
 * import nanoclaw modules that load better-sqlite3 at module scope.
 */
import fs from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";
import { CONFIG } from "../config.js";

const HISTORY_CUTOFF_KEY = "conversation:history_cutoff";
const HANDOFF_PREFIX = "[Conversation handoff]";

export interface BridgeSession {
  id: string;
  agent_group_id: string;
  messaging_group_id: string | null;
  thread_id: string | null;
  conversation_id?: string | null;
  agent_provider: string | null;
  status: "active" | "archived" | "closed";
  container_status: "running" | "idle" | "stopped";
  last_active: string | null;
  archived_at?: string | null;
  created_at: string;
}

export interface CallerContext {
  agentGroupId: string;
  messagingGroupId: string | null;
  threadId: string;
  sessionMode: "per-thread" | "shared" | "agent-shared";
  channelType: string;
  platformId: string;
  userId: string;
}

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: string;
}

export interface DeliveryAddress {
  channelType: string;
  platformId: string;
  threadId: string;
}

let centralDb: Database | null = null;
let schemaCache: { inbound: string; outbound: string } | null = null;

function nanoclawSrc(rel: string): string {
  return path.join(CONFIG.NANOCLAW_PATH, "src", rel);
}

export function sessionsBaseDir(): string {
  return path.join(CONFIG.DATA_PATH, "v2-sessions");
}

export function sessionDir(agentGroupId: string, sessionId: string): string {
  return path.join(sessionsBaseDir(), agentGroupId, sessionId);
}

export function inboundDbPath(agentGroupId: string, sessionId: string): string {
  return path.join(sessionDir(agentGroupId, sessionId), "inbound.db");
}

export function outboundDbPath(agentGroupId: string, sessionId: string): string {
  return path.join(sessionDir(agentGroupId, sessionId), "outbound.db");
}

async function loadSessionSchemas(): Promise<{ inbound: string; outbound: string }> {
  if (schemaCache) return schemaCache;
  const mod = await import(nanoclawSrc("db/schema.js"));
  schemaCache = { inbound: mod.INBOUND_SCHEMA, outbound: mod.OUTBOUND_SCHEMA };
  return schemaCache;
}

function ensureSessionDbFile(dbPath: string, schemaSql: string): void {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.run("PRAGMA journal_mode = DELETE");
  db.exec(schemaSql);
  db.close();
}

export function initSessionFolder(agentGroupId: string, sessionId: string, schemas: { inbound: string; outbound: string }): void {
  const dir = sessionDir(agentGroupId, sessionId);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "outbox"), { recursive: true });
  ensureSessionDbFile(inboundDbPath(agentGroupId, sessionId), schemas.inbound);
  ensureSessionDbFile(outboundDbPath(agentGroupId, sessionId), schemas.outbound);
}

function tableExists(db: Database, name: string): boolean {
  const row = db
    .query("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .get(name) as { ok: number } | null;
  return row?.ok === 1;
}

/** Initialize central NanoClaw DB (bun:sqlite) for conversation lifecycle from the UI gateway. */
export async function ensureConversationDb(): Promise<void> {
  if (centralDb) return;

  fs.mkdirSync(path.dirname(CONFIG.DB_PATH), { recursive: true });
  centralDb = new Database(CONFIG.DB_PATH);
  centralDb.run("PRAGMA journal_mode = WAL");
  centralDb.run("PRAGMA foreign_keys = ON");

  if (!tableExists(centralDb, "schema_version") && !tableExists(centralDb, "agent_groups")) {
    throw new Error(
      "Banco central do NanoClaw não encontrado. Inicie o host NanoClaw (Node) ou rode o setup antes de usar o app Mac.",
    );
  }

  await loadSessionSchemas();
}

function getCentralDb(): Database {
  if (!centralDb) throw new Error("Database not initialized. Call ensureConversationDb() first.");
  return centralDb;
}

function findUiConversationSession(agentGroupId: string, threadId: string): BridgeSession | undefined {
  return getCentralDb()
    .query(
      `SELECT * FROM sessions
       WHERE agent_group_id = ?
         AND messaging_group_id IS NULL
         AND thread_id = ?
         AND status = 'active'
         AND thread_id NOT LIKE 'system:%'`,
    )
    .get(agentGroupId, threadId) as BridgeSession | undefined;
}

function createSessionRow(session: BridgeSession): void {
  getCentralDb().run(
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
  getCentralDb().run(
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

export function resolveActiveSession(ctx: CallerContext): { session: BridgeSession; created: boolean } {
  if (ctx.sessionMode === "per-thread" && ctx.threadId) {
    const existing = findUiConversationSession(ctx.agentGroupId, ctx.threadId);
    if (existing) return { session: existing, created: false };
  }

  const schemas = schemaCache!;
  if (!schemas) {
    throw new Error("Session schemas not loaded.");
  }
  const id = generateSessionId();
  const conversationId = generateConversationId();
  const session: BridgeSession = {
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
  initSessionFolder(ctx.agentGroupId, id, schemas);
  return { session, created: true };
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

export function readConversationHistory(
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
    channelType: string;
    threadId: string;
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

function startNewConversation(
  ctx: CallerContext,
  current: BridgeSession,
  opts?: { handoffText?: string },
): BridgeSession {
  archiveSessionRow(current.id);
  const { session: next } = resolveActiveSession(ctx);

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
}

export async function executeConversationCommand(
  command: "clear" | "new" | "new-resume",
  ctx: CallerContext,
  _delivery: DeliveryAddress,
  options: { summarizeWithLlm?: (messages: ConversationMessage[]) => Promise<string> } = {},
): Promise<{ handled: boolean; reply: string; session: BridgeSession }> {
  const { session: current } = resolveActiveSession(ctx);

  switch (command) {
    case "clear": {
      const dbPath = outboundDbPath(ctx.agentGroupId, current.id);
      if (fs.existsSync(dbPath)) {
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
      }
      return { handled: true, reply: "Sessão limpa.", session: current };
    }
    case "new": {
      const next = startNewConversation(ctx, current);
      return { handled: true, reply: "Nova conversa iniciada.", session: next };
    }
    case "new-resume": {
      const history = readConversationHistory(ctx.agentGroupId, current.id, 50);
      const { summarizeConversation } = await import(nanoclawSrc("conversations/summarizer.js"));
      const summary = await summarizeConversation(history, options.summarizeWithLlm);
      const next = startNewConversation(ctx, current, { handoffText: summary });
      return {
        handled: true,
        reply: "Nova conversa iniciada com contexto da anterior.",
        session: next,
      };
    }
    default:
      throw new Error(`Unknown conversation command: ${command}`);
  }
}

/** Load conversation helpers (Bun-safe — no better-sqlite3). */
export async function loadConversationModule() {
  await ensureConversationDb();
  await loadSessionSchemas();
  const { parseConversationCommand } = await import(nanoclawSrc("conversations/commands.js"));
  const { createLlmSummarizeFn } = await import(nanoclawSrc("conversations/summarizer.js"));
  return {
    parseConversationCommand,
    createLlmSummarizeFn,
    resolveActiveSession,
    readConversationHistory,
    executeConversationCommand,
  };
}

/** Path helpers for session DB files (Bun-safe). */
export async function loadSessionManager() {
  await ensureConversationDb();
  await loadSessionSchemas();
  return {
    initSessionFolder,
    inboundDbPath,
    outboundDbPath,
  };
}
