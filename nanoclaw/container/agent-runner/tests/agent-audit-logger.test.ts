import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AgentAuditLogger } from '../src/agents/audit-logger.js';

describe('AgentAuditLogger', () => {
  let tmpDir: string;

  beforeEach(() => {
    AgentAuditLogger.clear();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-audit-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('recordStep adds timestamp and default latency', () => {
    AgentAuditLogger.recordStep(tmpDir, {
      step: 'supervisor_turn_start',
      agent: 'orchestrator',
      purpose: 'test',
    });

    const traces = AgentAuditLogger.getTraces();
    expect(traces.length).toBe(1);
    expect(traces[0].timestamp).toBeTruthy();
    expect(traces[0].latencyMs).toBe(0);
    expect(traces[0].step).toBe('supervisor_turn_start');
  });

  test('record persists JSONL and SQLite to cwd/logs', () => {
    AgentAuditLogger.recordStep(tmpDir, {
      step: 'worker_execution',
      agent: 'productivity_attendant',
      purpose: 'Worker iteration 1',
      messageId: 'msg-123',
      supervisorStep: 1,
      latencyMs: 42,
    });

    const logPath = path.join(tmpDir, 'logs', 'agent_audit.jsonl');
    const dbPath = path.join(tmpDir, 'logs', 'agent_audit.db');
    expect(fs.existsSync(logPath)).toBe(true);
    expect(fs.existsSync(dbPath)).toBe(true);

    const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
    expect(lines.length).toBe(1);

    const row = JSON.parse(lines[0]);
    expect(row.step).toBe('worker_execution');
    expect(row.messageId).toBe('msg-123');
    expect(row.supervisorStep).toBe(1);
    expect(row.latencyMs).toBe(42);
  });

  test('clear resets in-memory traces', () => {
    AgentAuditLogger.recordStep(tmpDir, {
      step: 'orchestrator_triage',
      purpose: 'triage',
    });
    expect(AgentAuditLogger.getTraces().length).toBe(1);
    AgentAuditLogger.clear();
    expect(AgentAuditLogger.getTraces().length).toBe(0);
  });
});
