import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import glob from "fast-glob";
import { CONFIG } from "../config.js";

export const PURGE_CONFIRMATION_PHRASE = "confirmar";

export interface PurgeChatAndCostsResult {
  sessionsWiped: number;
  archivedSessionsRemoved: number;
  staleFoldersRemoved: number;
  tokenLedgerRowsCleared: number;
  activeSessionsRemaining: number;
}

function listTables(dbPath: string): Set<string> {
  if (!fs.existsSync(dbPath)) return new Set();
  const db = new Database(dbPath, { readonly: true });
  try {
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    return new Set(rows.map((r) => r.name));
  } finally {
    db.close();
  }
}

function deleteFromTables(dbPath: string, tables: string[]): number {
  if (!fs.existsSync(dbPath)) return 0;
  const have = listTables(dbPath);
  const db = new Database(dbPath);
  let changes = 0;
  try {
    for (const table of tables) {
      if (!have.has(table)) continue;
      changes += db.prepare(`DELETE FROM ${table}`).run().changes;
    }
  } finally {
    db.close();
  }
  return changes;
}

function wipeSessionDir(sessionDir: string): void {
  deleteFromTables(path.join(sessionDir, "inbound.db"), ["messages_in", "delivered"]);
  deleteFromTables(path.join(sessionDir, "outbound.db"), [
    "messages_out",
    "processing_ack",
    "session_state",
  ]);
}

function listSessionDirs(sessionsRoot: string): string[] {
  if (!fs.existsSync(sessionsRoot)) return [];
  const dirs: string[] = [];
  for (const agentEntry of fs.readdirSync(sessionsRoot, { withFileTypes: true })) {
    if (!agentEntry.isDirectory() || !agentEntry.name.startsWith("ag-")) continue;
    const agentDir = path.join(sessionsRoot, agentEntry.name);
    for (const sessEntry of fs.readdirSync(agentDir, { withFileTypes: true })) {
      if (!sessEntry.isDirectory() || !sessEntry.name.startsWith("sess-")) continue;
      dirs.push(path.join(agentDir, sessEntry.name));
    }
  }
  return dirs;
}

function clearTokenLedgers(): number {
  let cleared = 0;
  const patterns = [
    path.join(CONFIG.GROUPS_PATH, "**/logs/token_ledger.db"),
    path.join(CONFIG.GROUPS_PATH, "**/logs/token_usage.db"),
    path.join(CONFIG.DATA_PATH, "**/token_ledger.db"),
    path.join(CONFIG.DATA_PATH, "**/token_usage.db"),
  ];

  for (const pattern of patterns) {
    for (const dbPath of glob.sync(pattern.replace(/\\/g, "/"))) {
      cleared += deleteFromTables(dbPath, ["token_ledger"]);
    }
  }

  for (const jsonlPath of glob.sync(
    path.join(CONFIG.GROUPS_PATH, "**/logs/token_ledger.jsonl").replace(/\\/g, "/"),
  )) {
    fs.writeFileSync(jsonlPath, "");
  }

  return cleared;
}

function clearCentralChatState(): number {
  if (!fs.existsSync(CONFIG.DB_PATH)) return 0;
  const db = new Database(CONFIG.DB_PATH);
  let archivedRemoved = 0;
  try {
    db.prepare("DELETE FROM pending_questions").run();

    for (const table of [
      "chat_sdk_kv",
      "chat_sdk_lists",
      "chat_sdk_locks",
      "chat_sdk_subscriptions",
    ]) {
      const exists = db
        .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(table);
      if (exists) db.prepare(`DELETE FROM ${table}`).run();
    }

    const archived = db
      .prepare("SELECT id FROM sessions WHERE status = 'archived'")
      .all() as Array<{ id: string }>;

    const sessionsRoot = path.join(CONFIG.DATA_PATH, "v2-sessions");
    if (fs.existsSync(sessionsRoot)) {
      for (const row of archived) {
        for (const agentEntry of fs.readdirSync(sessionsRoot, { withFileTypes: true })) {
          if (!agentEntry.isDirectory()) continue;
          const dir = path.join(sessionsRoot, agentEntry.name, row.id);
          if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
        }
      }
    }

    db.prepare(
      "DELETE FROM pending_approvals WHERE session_id IN (SELECT id FROM sessions WHERE status = 'archived')",
    ).run();
    archivedRemoved = db.prepare("DELETE FROM sessions WHERE status = 'archived'").run().changes;
  } finally {
    db.close();
  }
  return archivedRemoved;
}

function removeStaleSessionFolders(activeIds: Set<string>): number {
  const sessionsRoot = path.join(CONFIG.DATA_PATH, "v2-sessions");
  let removed = 0;
  for (const dir of listSessionDirs(sessionsRoot)) {
    const sessionId = path.basename(dir);
    if (!activeIds.has(sessionId)) {
      fs.rmSync(dir, { recursive: true, force: true });
      removed += 1;
    }
  }
  return removed;
}

/** Wipes all chat messages, session LLM state, archived sessions, and token/cost ledgers. */
export function purgeChatAndCosts(): PurgeChatAndCostsResult {
  const archivedSessionsRemoved = clearCentralChatState();

  const activeIds = new Set<string>();
  if (fs.existsSync(CONFIG.DB_PATH)) {
    const db = new Database(CONFIG.DB_PATH, { readonly: true });
    try {
      const rows = db.prepare("SELECT id FROM sessions").all() as Array<{ id: string }>;
      for (const row of rows) activeIds.add(row.id);
    } finally {
      db.close();
    }
  }

  const sessionsRoot = path.join(CONFIG.DATA_PATH, "v2-sessions");
  let sessionsWiped = 0;
  for (const dir of listSessionDirs(sessionsRoot)) {
    const sessionId = path.basename(dir);
    if (activeIds.has(sessionId)) {
      wipeSessionDir(dir);
      sessionsWiped += 1;
    }
  }

  const staleFoldersRemoved = removeStaleSessionFolders(activeIds);
  const tokenLedgerRowsCleared = clearTokenLedgers();

  return {
    sessionsWiped,
    archivedSessionsRemoved,
    staleFoldersRemoved,
    tokenLedgerRowsCleared,
    activeSessionsRemaining: activeIds.size,
  };
}

export function isValidPurgeConfirmation(value: unknown): value is string {
  return typeof value === "string" && value.trim().toLowerCase() === PURGE_CONFIRMATION_PHRASE;
}
