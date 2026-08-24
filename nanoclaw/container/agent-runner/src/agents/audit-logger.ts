import fs from 'fs';
import path from 'path';
import { Database } from 'bun:sqlite';
import type { AgentAuditTrace } from './types.js';

export type AgentAuditTraceInput = Omit<AgentAuditTrace, 'timestamp' | 'latencyMs'> & {
  timestamp?: string;
  latencyMs?: number;
};

function initAuditDb(dbPath: string): Database | null {
  try {
    const db = new Database(dbPath);
    db.run(`
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
    `);
    return db;
  } catch {
    return null;
  }
}

function buildAuditId(trace: AgentAuditTrace, seq: number): string {
  return `${trace.timestamp}-${trace.step}-${seq}`;
}

export class AgentAuditLogger {
  private static traces: AgentAuditTrace[] = [];

  /** Grava trace com timestamp/latency padrão — único ponto para auditoria estruturada. */
  static recordStep(cwd: string, trace: AgentAuditTraceInput): void {
    this.record(cwd, {
      latencyMs: trace.latencyMs ?? 0,
      timestamp: trace.timestamp ?? new Date().toISOString(),
      ...trace,
    });
  }

  static record(cwd: string, trace: AgentAuditTrace): void {
    this.traces.push(trace);

    try {
      const logDir = path.join(cwd, 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // 1. JSONL (append log / backup)
      const logPath = path.join(logDir, 'agent_audit.jsonl');
      fs.appendFileSync(logPath, JSON.stringify(trace) + '\n', 'utf-8');

      // 2. SQLite (consultas paginadas — source of truth para leitura)
      const dbPath = path.join(logDir, 'agent_audit.db');
      const db = initAuditDb(dbPath);
      if (db) {
        try {
          const countRow = db
            .query('SELECT COUNT(*) AS count FROM agent_audit WHERE timestamp = ? AND step = ?')
            .get(trace.timestamp, trace.step) as { count: number };
          const id = buildAuditId(trace, countRow?.count ?? 0);
          db.run(
            `INSERT OR REPLACE INTO agent_audit (
              id, step, timestamp, purpose, latency_ms, agent, department, message_id,
              supervisor_step, decision, prompt_preview, response_preview, metadata_json, tokens_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              trace.step,
              trace.timestamp,
              trace.purpose,
              trace.latencyMs ?? 0,
              trace.agent ?? null,
              trace.department ?? null,
              trace.messageId ?? null,
              trace.supervisorStep ?? null,
              trace.decision ?? null,
              trace.promptPreview ?? null,
              trace.responsePreview ?? null,
              trace.metadata ? JSON.stringify(trace.metadata) : null,
              trace.tokens ? JSON.stringify(trace.tokens) : null,
            ],
          );
        } finally {
          db.close();
        }
      }
    } catch (err) {
      console.error('[AgentAuditLogger] Failed to write audit log:', err);
    }
  }

  static getTraces(): AgentAuditTrace[] {
    return [...this.traces];
  }

  static clear(): void {
    this.traces = [];
  }
}
