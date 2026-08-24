/**
 * UI-facing scheduled task service — reads the official `ncl tasks` store
 * (`kind='task'` rows in per-series system sessions), not legacy schedule_followup chat rows.
 */
import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import { CronExpressionParser } from "cron-parser";
import { CONFIG } from "../config.js";

const TASKS_THREAD_PREFIX = "system:tasks";

export interface ScheduledTaskItem {
  id: string;
  rowId: string;
  agentGroupId: string;
  agentGroupName: string;
  agentGroupFolder: string;
  sessionId: string;
  status: string;
  createdAt: string;
  processAfter: string | null;
  recurrence: string | null;
  isRecurring: boolean;
  prompt: string;
  runs: number;
  failedRuns: number;
  lastRun: string | null;
  hasScript: boolean;
  /** @deprecated UI compat — same as agentGroupFolder channel context */
  channelType: string;
  cleanPrompt: string;
  kind: string;
}

export interface TaskExecutionLogItem {
  id: string;
  seriesId: string;
  timestamp: string;
  status: string;
  cron?: string | null;
  channelType: string;
  prompt: string;
  cleanPrompt: string;
  resultText?: string;
  agentGroupName: string;
}

interface TaskContent {
  prompt: string;
  script: string | null;
}

interface TaskRow {
  row_id: string;
  series_id: string | null;
  status: string;
  process_after: string | null;
  recurrence: string | null;
  content: string;
  timestamp: string;
}

function centralDb(): Database {
  return new Database(CONFIG.DB_PATH, { readonly: true });
}

function sessionsRoot(): string {
  return path.join(CONFIG.DATA_PATH, "v2-sessions");
}

function parseTaskContent(raw: string): TaskContent {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      prompt: typeof parsed.prompt === "string" ? parsed.prompt : "",
      script: typeof parsed.script === "string" ? parsed.script : null,
    };
  } catch {
    return { prompt: raw, script: null };
  }
}

function seriesStats(db: Database, seriesKey: string): { runs: number; lastRun: string | null; failedRuns: number } {
  return db
    .query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'completed') AS runs,
         MAX(process_after) FILTER (WHERE status = 'completed') AS "lastRun",
         COUNT(*) FILTER (WHERE status = 'failed') AS "failedRuns"
       FROM messages_in
      WHERE kind = 'task' AND (id = ? OR series_id = ?)`,
    )
    .get(seriesKey, seriesKey) as { runs: number; lastRun: string | null; failedRuns: number };
}

function selectLiveTasks(db: Database): TaskRow[] {
  return db
    .query(
      `SELECT id AS row_id, series_id, status, process_after, recurrence, content, timestamp
         FROM messages_in
        WHERE kind = 'task'
          AND status IN ('pending', 'paused')
        GROUP BY series_id
        ORDER BY datetime(process_after) ASC`,
    )
    .all() as TaskRow[];
}

function findTaskSession(agentGroupId: string, sessionId: string): string | null {
  const dbPath = path.join(sessionsRoot(), agentGroupId, sessionId, "inbound.db");
  return fs.existsSync(dbPath) ? dbPath : null;
}

function listTaskSessions(
  central: Database,
  groupFilter?: string,
): Array<{ agentGroupId: string; sessionId: string; name: string; folder: string }> {
  // DB central ainda não migrado pelo motor (ex.: UI subiu antes) → sem sessões.
  let groups: Array<{ id: string; name: string; folder: string }>;
  try {
    groups = groupFilter
      ? (central.query("SELECT id, name, folder FROM agent_groups WHERE folder = ?").all(groupFilter) as Array<{
          id: string;
          name: string;
          folder: string;
        }>)
      : (central.query("SELECT id, name, folder FROM agent_groups").all() as Array<{
          id: string;
          name: string;
          folder: string;
        }>);
  } catch {
    return [];
  }

  const out: Array<{ agentGroupId: string; sessionId: string; name: string; folder: string }> = [];
  for (const g of groups) {
    const rows = central
      .query(
        `SELECT id FROM sessions
         WHERE agent_group_id = ?
           AND status = 'active'
           AND messaging_group_id IS NULL
           AND (thread_id = ? OR thread_id LIKE ?)`,
      )
      .all(g.id, TASKS_THREAD_PREFIX, `${TASKS_THREAD_PREFIX}:%`) as Array<{ id: string }>;
    for (const row of rows) {
      out.push({ agentGroupId: g.id, sessionId: row.id, name: g.name, folder: g.folder });
    }
  }
  return out;
}

function toTaskItem(
  row: TaskRow,
  meta: { agentGroupId: string; sessionId: string; name: string; folder: string },
  stats: ReturnType<typeof seriesStats>,
): ScheduledTaskItem {
  const content = parseTaskContent(row.content);
  const seriesId = row.series_id ?? row.row_id;
  const isRecurring = Boolean(row.recurrence);
  return {
    id: seriesId,
    rowId: row.row_id,
    agentGroupId: meta.agentGroupId,
    agentGroupName: meta.name,
    agentGroupFolder: meta.folder,
    sessionId: meta.sessionId,
    status: row.status,
    createdAt: row.timestamp,
    processAfter: row.process_after,
    recurrence: row.recurrence,
    isRecurring,
    prompt: content.prompt,
    cleanPrompt: content.prompt,
    runs: stats.runs,
    failedRuns: stats.failedRuns,
    lastRun: stats.lastRun,
    hasScript: Boolean(content.script),
    channelType: meta.folder,
    kind: isRecurring ? "Rotina periódica (ncl tasks)" : "Tarefa agendada (ncl tasks)",
  };
}

export function listScheduledTasks(groupFolder?: string): ScheduledTaskItem[] {
  const central = centralDb();
  try {
    const sessions = listTaskSessions(central, groupFolder);
    const tasks: ScheduledTaskItem[] = [];

    for (const sess of sessions) {
      const dbPath = findTaskSession(sess.agentGroupId, sess.sessionId);
      if (!dbPath) continue;
      const inDb = new Database(dbPath, { readonly: true });
      try {
        for (const row of selectLiveTasks(inDb)) {
          const seriesId = row.series_id ?? row.row_id;
          const stats = seriesStats(inDb, seriesId);
          tasks.push(toTaskItem(row, sess, stats));
        }
      } finally {
        inDb.close();
      }
    }

    tasks.sort((a, b) => {
      const ta = a.processAfter ? Date.parse(a.processAfter) : 0;
      const tb = b.processAfter ? Date.parse(b.processAfter) : 0;
      return tb - ta;
    });
    return tasks;
  } finally {
    central.close();
  }
}

function locateTaskSeries(
  taskId: string,
  statuses: Array<'pending' | 'paused'> = ['pending', 'paused'],
): {
  agentGroupId: string;
  sessionId: string;
  dbPath: string;
} | null {
  const central = centralDb();
  const statusSql = statuses.map(() => '?').join(', ');
  try {
    for (const sess of listTaskSessions(central)) {
      const dbPath = findTaskSession(sess.agentGroupId, sess.sessionId);
      if (!dbPath) continue;
      const inDb = new Database(dbPath, { readonly: true });
      try {
        const hit = inDb
          .query(
            `SELECT 1 FROM messages_in
             WHERE kind = 'task'
               AND (id = ? OR series_id = ?)
               AND status IN (${statusSql})
             LIMIT 1`,
          )
          .get(taskId, taskId, ...statuses);
        if (hit) {
          return { agentGroupId: sess.agentGroupId, sessionId: sess.sessionId, dbPath };
        }
      } finally {
        inDb.close();
      }
    }
    return null;
  } finally {
    central.close();
  }
}

export function pauseScheduledTask(taskId: string): boolean {
  const loc = locateTaskSeries(taskId, ['pending']);
  if (!loc) return false;
  const inDb = new Database(loc.dbPath);
  try {
    const changes = inDb
      .query(
        "UPDATE messages_in SET status = 'paused' WHERE (id = ? OR series_id = ?) AND kind = 'task' AND status = 'pending'",
      )
      .run(taskId, taskId).changes;
    return changes > 0;
  } finally {
    inDb.close();
  }
}

export function resumeScheduledTask(taskId: string): boolean {
  const loc = locateTaskSeries(taskId, ['paused']);
  if (!loc) return false;
  const inDb = new Database(loc.dbPath);
  try {
    const changes = inDb
      .query(
        "UPDATE messages_in SET status = 'pending' WHERE (id = ? OR series_id = ?) AND kind = 'task' AND status = 'paused'",
      )
      .run(taskId, taskId).changes;
    return changes > 0;
  } finally {
    inDb.close();
  }
}

export function cancelScheduledTask(taskId: string): boolean {
  const loc = locateTaskSeries(taskId);
  if (!loc) return false;
  const inDb = new Database(loc.dbPath);
  try {
    const changes = inDb
      .query(
        "UPDATE messages_in SET status = 'cancelled', recurrence = NULL WHERE (id = ? OR series_id = ?) AND kind = 'task' AND status IN ('pending', 'paused')",
      )
      .run(taskId, taskId).changes;
    return changes > 0;
  } finally {
    inDb.close();
  }
}

export function updateScheduledTask(
  taskId: string,
  data: { cron?: string; prompt?: string },
): boolean {
  const loc = locateTaskSeries(taskId);
  if (!loc) return false;

  const inDb = new Database(loc.dbPath);
  try {
    const rows = inDb
      .query(
        "SELECT id, content, recurrence, process_after FROM messages_in WHERE (id = ? OR series_id = ?) AND kind = 'task' AND status IN ('pending', 'paused')",
      )
      .all(taskId, taskId) as Array<{
      id: string;
      content: string;
      recurrence: string | null;
      process_after: string | null;
    }>;

    if (rows.length === 0) return false;

    for (const row of rows) {
      const parsed = JSON.parse(row.content) as Record<string, unknown>;
      if (data.prompt !== undefined) parsed.prompt = data.prompt.trim();
      const content = JSON.stringify(parsed);

      const newRecurrence = data.cron?.trim() ?? row.recurrence;
      let processAfter = row.process_after;
      if (newRecurrence && data.cron?.trim()) {
        try {
          processAfter = CronExpressionParser.parse(newRecurrence).next().toISOString();
        } catch {}
      }

      inDb
        .query("UPDATE messages_in SET content = ?, recurrence = ?, process_after = ? WHERE id = ?")
        .run(content, newRecurrence, processAfter, row.id);
    }
    return true;
  } finally {
    inDb.close();
  }
}

export function countTaskExecutionLogs(groupFolder?: string): number {
  const central = centralDb();
  let total = 0;
  try {
    for (const sess of listTaskSessions(central, groupFolder)) {
      const dbPath = findTaskSession(sess.agentGroupId, sess.sessionId);
      if (!dbPath) continue;
      const inDb = new Database(dbPath, { readonly: true });
      try {
        const row = inDb
          .query(
            `SELECT COUNT(*) AS count
             FROM messages_in
             WHERE kind = 'task' AND status IN ('completed', 'failed')`,
          )
          .get() as { count: number };
        total += row?.count ?? 0;
      } catch {
        // sessão sem schema de tasks ainda — contribui 0
      } finally {
        inDb.close();
      }
    }
  } catch {
    return 0;
  } finally {
    central.close();
  }
  return total;
}

export function getTaskExecutionLogs(
  limit?: number,
  groupFolder?: string,
  offset = 0,
): TaskExecutionLogItem[] {
  const central = centralDb();
  const logs: TaskExecutionLogItem[] = [];
  try {
    for (const sess of listTaskSessions(central, groupFolder)) {
      const dbPath = findTaskSession(sess.agentGroupId, sess.sessionId);
      if (!dbPath) continue;
      const outDbPath = path.join(path.dirname(dbPath), "outbound.db");

      const inDb = new Database(dbPath, { readonly: true });
      let outDb: Database | null = null;
      try {
        if (fs.existsSync(outDbPath)) {
          outDb = new Database(outDbPath, { readonly: true });
        }

        const rows = inDb
          .query(
            `SELECT id, series_id, timestamp, status, process_after, recurrence, content
             FROM messages_in
             WHERE kind = 'task' AND status IN ('completed', 'failed')
             ORDER BY timestamp DESC`,
          )
          .all() as Array<{
          id: string;
          series_id: string | null;
          timestamp: string;
          status: string;
          process_after: string | null;
          recurrence: string | null;
          content: string;
        }>;

        for (const r of rows) {
          const content = parseTaskContent(r.content);
          let resultText = "";
          if (outDb) {
            const outRow = outDb
              .query("SELECT content FROM messages_out WHERE in_reply_to = ? ORDER BY timestamp DESC LIMIT 1")
              .get(r.id) as { content: string } | undefined;
            if (outRow?.content) {
              try {
                const parsedOut = JSON.parse(outRow.content) as { text?: string };
                resultText = parsedOut.text || outRow.content;
              } catch {
                resultText = outRow.content;
              }
            }
          }

          logs.push({
            id: r.id,
            seriesId: r.series_id ?? r.id,
            timestamp: r.process_after ?? r.timestamp,
            status: r.status,
            cron: r.recurrence,
            channelType: sess.folder,
            prompt: content.prompt,
            cleanPrompt: content.prompt,
            resultText,
            agentGroupName: sess.name,
          });
        }
      } finally {
        inDb.close();
        outDb?.close();
      }
    }

    logs.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    const start = Math.max(0, offset);
    const end = typeof limit === "number" ? start + limit : undefined;
    return logs.slice(start, end);
  } finally {
    central.close();
  }
}

export function getTaskExecutionLogsWithTotal(
  limit?: number,
  groupFolder?: string,
  offset = 0,
): { logs: TaskExecutionLogItem[]; total: number } {
  const total = countTaskExecutionLogs(groupFolder);
  const logs = getTaskExecutionLogs(limit, groupFolder, offset);
  return { logs, total };
}
