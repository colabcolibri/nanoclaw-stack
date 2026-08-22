import fs from 'fs';
import path from 'path';
import type { AgentAuditTrace } from './types.js';

export type AgentAuditTraceInput = Omit<AgentAuditTrace, 'timestamp' | 'latencyMs'> & {
  timestamp?: string;
  latencyMs?: number;
};

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
      const logPath = path.join(logDir, 'agent_audit.jsonl');
      fs.appendFileSync(logPath, JSON.stringify(trace) + '\n', 'utf-8');
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
