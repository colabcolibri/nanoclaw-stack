import { Database } from "bun:sqlite";
import {
  formatPurposeLabel,
  getPurposeMeta,
  parseToolNameFromPreview,
  resolvePurpose,
} from "../../../../nanoclaw/container/agent-runner/src/services/llm-call-purpose.js";
import { getTaskExecutionLogs } from "../scheduled-tasks.js";
import { auditStepLabel, resolveLedgerKind } from "./kind.js";
import type { RunDetailItem, RunDetailRef } from "./types.js";

function parseJsonObject(raw: string | null): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function loadLedgerDetail(sourceDb: string, id: string): RunDetailItem | null {
  const db = new Database(sourceDb, { readonly: true });
  try {
    const row = db
      .query(
        `SELECT id, timestamp, model, message_id, purpose, total_tokens, cost_brl,
                latency_ms, has_tool_calls, tool_calls_count, preview, content
         FROM token_ledger
         WHERE id = ?
         LIMIT 1`,
      )
      .get(id) as Record<string, unknown> | undefined;

    if (!row) return null;

    const preview = String(row.preview ?? "");
    const purpose = resolvePurpose({
      purpose: row.purpose as string,
      preview,
      hasToolCalls: Boolean(row.has_tool_calls),
      toolCallsCount: Number(row.tool_calls_count ?? 0),
    });
    const toolName = parseToolNameFromPreview(preview);
    const category = formatPurposeLabel(purpose, { toolName: toolName || undefined });
    const kind = resolveLedgerKind({
      purpose: row.purpose as string,
      preview,
      hasToolCalls: Boolean(row.has_tool_calls),
      toolCallsCount: Number(row.tool_calls_count ?? 0),
    });

    return {
      id: String(row.id),
      kind,
      category,
      timestamp: String(row.timestamp),
      status: "completed",
      model: row.model ? String(row.model) : undefined,
      tokens: row.total_tokens != null ? Number(row.total_tokens) : undefined,
      costBrl: row.cost_brl != null ? Number(row.cost_brl) : undefined,
      latencyMs: row.latency_ms != null ? Number(row.latency_ms) : undefined,
      messageId: row.message_id ? String(row.message_id) : undefined,
      detailRef: { source: "ledger", sourceDb },
      prompt: String(row.content || row.preview || ""),
      output: String(row.content || row.preview || ""),
    };
  } finally {
    db.close();
  }
}

function loadAuditDetail(sourceDb: string, id: string): RunDetailItem | null {
  const db = new Database(sourceDb, { readonly: true });
  try {
    const row = db
      .query(
        `SELECT id, step, timestamp, purpose, latency_ms, agent, department, message_id,
                supervisor_step, decision, prompt_preview, response_preview, metadata_json
         FROM agent_audit
         WHERE id = ?
         LIMIT 1`,
      )
      .get(id) as Record<string, unknown> | undefined;

    if (!row) return null;

    const category = auditStepLabel(String(row.step));
    const metadata = parseJsonObject(row.metadata_json as string | null);
    const output =
      (row.response_preview as string | null) ||
      (metadata ? JSON.stringify(metadata, null, 2) : "");

    return {
      id: String(row.id),
      kind: "audit",
      category,
      timestamp: String(row.timestamp),
      status: "completed",
      latencyMs: row.latency_ms != null ? Number(row.latency_ms) : undefined,
      messageId: row.message_id ? String(row.message_id) : undefined,
      agent: row.agent ? String(row.agent) : undefined,
      department: row.department ? String(row.department) : undefined,
      supervisorStep: row.supervisor_step != null ? Number(row.supervisor_step) : undefined,
      decision: row.decision ? String(row.decision) : undefined,
      detailRef: { source: "audit", sourceDb },
      prompt: (row.prompt_preview as string | null) || String(row.purpose ?? ""),
      output,
      auditMetadata: metadata,
    };
  } finally {
    db.close();
  }
}

function loadCronDetail(sourceKey: string, id: string): RunDetailItem | null {
  const groupFolder = sourceKey === "cron:all" ? undefined : sourceKey.replace(/^cron:/, "");
  const logs = getTaskExecutionLogs(undefined, groupFolder || undefined);
  const log = logs.find((entry) => entry.id === id);
  if (!log) return null;

  return {
    id: log.id,
    kind: "cron",
    category: "Rotina Recorrente (Cron)",
    timestamp: log.timestamp,
    status: log.status || "completed",
    model: "openai/gpt-oss-20b",
    cron: log.cron ?? undefined,
    channel: log.channelType || "telegram",
    detailRef: { source: "cron", sourceDb: sourceKey },
    prompt: log.cleanPrompt || log.prompt,
    output: log.resultText,
  };
}

export function getRunDetail(ref: RunDetailRef, id: string): RunDetailItem | null {
  switch (ref.source) {
    case "ledger":
      return loadLedgerDetail(ref.sourceDb, id);
    case "audit":
      return loadAuditDetail(ref.sourceDb, id);
    case "cron":
      return loadCronDetail(ref.sourceDb, id);
    default:
      return null;
  }
}
