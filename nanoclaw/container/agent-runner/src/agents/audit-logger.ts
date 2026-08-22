import fs from 'fs';
import path from 'path';
import type { AgentAuditTrace } from './types.js';

export class AgentAuditLogger {
  private static traces: AgentAuditTrace[] = [];

  static record(cwd: string, trace: AgentAuditTrace): void {
    this.traces.push(trace);

    // Persist to JSONL file
    try {
      const logDir = path.join(cwd, 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const logPath = path.join(logDir, 'agent_audit.jsonl');
      const entry = JSON.stringify(trace);
      fs.appendFileSync(logPath, entry + '\n', 'utf-8');
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
