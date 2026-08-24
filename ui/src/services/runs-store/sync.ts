import fs from "node:fs";
import path from "node:path";
import glob from "fast-glob";
import { Database } from "bun:sqlite";
import { CONFIG } from "../../config.js";
import { parseAgentAuditJsonl } from "../audit-traces.js";
import { countTaskExecutionLogs, getTaskExecutionLogs } from "../scheduled-tasks.js";
import {
  deleteSourceRows,
  fileMtimeMs,
  isSourceFresh,
  markSourceSynced,
  openRunsIndexDb,
  setIndexMeta,
} from "./db.js";
import {
  auditStepLabel,
  buildSearchText,
  resolveLedgerCategory,
  resolveLedgerKind,
} from "./kind.js";
import { AGENT_AUDIT_DDL } from "./schema.js";
import type { RunIndexRow } from "./types.js";

const INSERT_INDEX_SQL = `
INSERT OR REPLACE INTO runs_index (
  id, source, source_db, kind, category, timestamp, status,
  model, tokens, cost_brl, latency_ms, message_id, search_text
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function upsertIndexRows(db: Database, rows: RunIndexRow[]): number {
  const insert = db.prepare(INSERT_INDEX_SQL);
  db.run("BEGIN");
  try {
    for (const row of rows) {
      insert.run(
        row.id,
        row.source,
        row.sourceDb,
        row.kind,
        row.category,
        row.timestamp,
        row.status,
        row.model,
        row.tokens,
        row.costBrl,
        row.latencyMs,
        row.messageId,
        row.searchText,
      );
    }
    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
  return rows.length;
}

function ensureAgentAuditDb(logDir: string): string | null {
  const dbPath = path.join(logDir, "agent_audit.db");
  const jsonlPath = path.join(logDir, "agent_audit.jsonl");

  if (fs.existsSync(dbPath)) return dbPath;
  if (!fs.existsSync(jsonlPath)) return null;

  const db = new Database(dbPath);
  try {
    db.run(AGENT_AUDIT_DDL);
    const content = fs.readFileSync(jsonlPath, "utf-8");
    const lines = content.split("\n");
    const traces = parseAgentAuditJsonl(lines);
    const insert = db.prepare(`
      INSERT OR IGNORE INTO agent_audit (
        id, step, timestamp, purpose, latency_ms, agent, department, message_id,
        supervisor_step, decision, prompt_preview, response_preview, metadata_json, tokens_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.run("BEGIN");
    for (const trace of traces) {
      insert.run(
        trace.id,
        trace.step,
        trace.timestamp,
        trace.purpose,
        trace.latencyMs,
        trace.agent ?? null,
        trace.department ?? null,
        trace.messageId ?? null,
        trace.supervisorStep ?? null,
        trace.decision ?? null,
        trace.promptPreview ?? null,
        trace.responsePreview ?? null,
        trace.metadata ? JSON.stringify(trace.metadata) : null,
        trace.tokens ? JSON.stringify(trace.tokens) : null,
      );
    }
    db.run("COMMIT");
  } finally {
    db.close();
  }

  return dbPath;
}

function syncLedgerDb(db: Database, dbPath: string): number {
  const mtime = fileMtimeMs(dbPath);
  if (mtime != null && isSourceFresh(db, dbPath, mtime)) return 0;

  deleteSourceRows(db, dbPath);
  const ledger = new Database(dbPath, { readonly: true });
  try {
    const rows = ledger
      .query(
        `SELECT id, timestamp, model, message_id, purpose, total_tokens, cost_brl,
                latency_ms, has_tool_calls, tool_calls_count, preview
         FROM token_ledger
         ORDER BY timestamp DESC`,
      )
      .all() as Array<{
      id: string;
      timestamp: string;
      model: string;
      message_id: string | null;
      purpose: string | null;
      total_tokens: number | null;
      cost_brl: number | null;
      latency_ms: number | null;
      has_tool_calls: number;
      tool_calls_count: number | null;
      preview: string | null;
    }>;

    const indexRows: RunIndexRow[] = rows.map((row) => {
      const kind = resolveLedgerKind({
        purpose: row.purpose,
        preview: row.preview,
        hasToolCalls: Boolean(row.has_tool_calls),
        toolCallsCount: row.tool_calls_count ?? 0,
      });
      const category = resolveLedgerCategory({
        purpose: row.purpose,
        preview: row.preview,
        hasToolCalls: Boolean(row.has_tool_calls),
        toolCallsCount: row.tool_calls_count ?? 0,
      });
      return {
        id: row.id,
        source: "ledger",
        sourceDb: dbPath,
        kind,
        category,
        timestamp: row.timestamp,
        status: "completed",
        model: row.model,
        tokens: row.total_tokens,
        costBrl: row.cost_brl,
        latencyMs: row.latency_ms,
        messageId: row.message_id,
        searchText: buildSearchText([row.id, category, row.model, row.preview]),
      };
    });

    const count = upsertIndexRows(db, indexRows);
    if (mtime != null) markSourceSynced(db, dbPath, mtime, count);
    return count;
  } finally {
    ledger.close();
  }
}

function syncAuditDb(db: Database, dbPath: string): number {
  const mtime = fileMtimeMs(dbPath);
  if (mtime != null && isSourceFresh(db, dbPath, mtime)) return 0;

  deleteSourceRows(db, dbPath);
  const auditDb = new Database(dbPath, { readonly: true });
  try {
    const rows = auditDb
      .query(
        `SELECT id, step, timestamp, purpose, latency_ms, agent, department, message_id,
                supervisor_step, decision, prompt_preview
         FROM agent_audit
         ORDER BY timestamp DESC`,
      )
      .all() as Array<{
      id: string;
      step: string;
      timestamp: string;
      purpose: string;
      latency_ms: number;
      agent: string | null;
      department: string | null;
      message_id: string | null;
      supervisor_step: number | null;
      decision: string | null;
      prompt_preview: string | null;
    }>;

    const indexRows: RunIndexRow[] = rows.map((row) => {
      const category = auditStepLabel(row.step);
      return {
        id: row.id,
        source: "audit",
        sourceDb: dbPath,
        kind: "audit",
        category,
        timestamp: row.timestamp,
        status: "completed",
        model: null,
        tokens: null,
        costBrl: null,
        latencyMs: row.latency_ms,
        messageId: row.message_id,
        searchText: buildSearchText([
          row.id,
          category,
          row.purpose,
          row.agent,
          row.prompt_preview,
        ]),
      };
    });

    const count = upsertIndexRows(db, indexRows);
    if (mtime != null) markSourceSynced(db, dbPath, mtime, count);
    return count;
  } finally {
    auditDb.close();
  }
}

function syncCronSource(db: Database, groupFolder?: string): number {
  const sourceKey = `cron:${groupFolder ?? "all"}`;
  const total = countTaskExecutionLogs(groupFolder);
  const row = db
    .query("SELECT row_count FROM runs_sync_state WHERE source_key = ?")
    .get(sourceKey) as { row_count: number } | undefined;

  if (row?.row_count === total && total > 0) return 0;

  deleteSourceRows(db, sourceKey);
  const logs = getTaskExecutionLogs(undefined, groupFolder);
  const indexRows: RunIndexRow[] = logs.map((log) => ({
    id: log.id,
    source: "cron",
    sourceDb: sourceKey,
    kind: "cron",
    category: "Rotina Recorrente (Cron)",
    timestamp: log.timestamp,
    status: log.status || "completed",
    model: "openai/gpt-oss-20b",
    tokens: null,
    costBrl: null,
    latencyMs: null,
    messageId: null,
    searchText: buildSearchText([log.id, log.prompt, log.cron, log.channelType]),
  }));

  const count = upsertIndexRows(db, indexRows);
  markSourceSynced(db, sourceKey, Date.now(), count);
  return count;
}

export function syncRunsIndex(groupFolder?: string): { syncedRows: number; syncedAt: string } {
  const db = openRunsIndexDb();
  try {
    let syncedRows = 0;
    const searchDirs = [path.join(CONFIG.GROUPS_PATH), path.join(CONFIG.DATA_PATH, "v2-sessions")];
    const dbDirs = new Set<string>();

    for (const baseDir of searchDirs) {
      if (!fs.existsSync(baseDir)) continue;
      for (const dbPath of glob.sync(`${baseDir}/**/token_ledger.db`)) {
        dbDirs.add(path.dirname(dbPath));
        syncedRows += syncLedgerDb(db, dbPath);
      }
    }

    for (const baseDir of searchDirs) {
      if (!fs.existsSync(baseDir)) continue;
      for (const jsonlPath of glob.sync(`${baseDir}/**/token_ledger.jsonl`)) {
        if (dbDirs.has(path.dirname(jsonlPath))) continue;
        const mtime = fileMtimeMs(jsonlPath);
        if (mtime != null && isSourceFresh(db, jsonlPath, mtime)) continue;
        deleteSourceRows(db, jsonlPath);
        try {
          const lines = fs.readFileSync(jsonlPath, "utf-8").split("\n");
          const indexRows: RunIndexRow[] = [];
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const rec = JSON.parse(line) as Record<string, unknown>;
              if (!rec.id || !rec.timestamp) continue;
              const preview = String(rec.preview ?? "");
              const kind = resolveLedgerKind({
                purpose: rec.purpose as string,
                preview,
                hasToolCalls: Boolean(rec.hasToolCalls),
                toolCallsCount: Number(rec.toolCallsCount ?? 0),
              });
              const category = resolveLedgerCategory({
                purpose: rec.purpose as string,
                preview,
                hasToolCalls: Boolean(rec.hasToolCalls),
                toolCallsCount: Number(rec.toolCallsCount ?? 0),
              });
              indexRows.push({
                id: String(rec.id),
                source: "ledger",
                sourceDb: jsonlPath,
                kind,
                category,
                timestamp: String(rec.timestamp),
                status: "completed",
                model: rec.model ? String(rec.model) : null,
                tokens: rec.totalTokens != null ? Number(rec.totalTokens) : null,
                costBrl: rec.costBrl != null ? Number(rec.costBrl) : null,
                latencyMs: rec.latencyMs != null ? Number(rec.latencyMs) : null,
                messageId: rec.messageId ? String(rec.messageId) : null,
                searchText: buildSearchText([String(rec.id), category, preview]),
              });
            } catch {}
          }
          syncedRows += upsertIndexRows(db, indexRows);
          if (mtime != null) markSourceSynced(db, jsonlPath, mtime, indexRows.length);
        } catch {}
      }
    }

    const auditDirs = groupFolder
      ? [path.join(CONFIG.GROUPS_PATH, groupFolder, "logs")]
      : glob.sync(`${CONFIG.GROUPS_PATH}/**/logs`);

    for (const logDir of auditDirs) {
      const auditDbPath = ensureAgentAuditDb(logDir);
      if (auditDbPath) syncedRows += syncAuditDb(db, auditDbPath);
    }

    syncedRows += syncCronSource(db, groupFolder);

    const syncedAt = new Date().toISOString();
    setIndexMeta(db, "last_sync_at", syncedAt);
    return { syncedRows, syncedAt };
  } finally {
    db.close();
  }
}
