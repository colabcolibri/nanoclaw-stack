import { describe, expect, test } from 'bun:test';
import { parseAgentAuditJsonl } from './audit-traces.js';

describe('parseAgentAuditJsonl', () => {
  test('parses valid lines and skips malformed rows', () => {
    const lines = [
      JSON.stringify({
        step: 'supervisor_turn_start',
        purpose: 'Supervisor turn started',
        timestamp: '2026-08-23T10:00:00.000Z',
        messageId: 'msg-1',
        latencyMs: 0,
      }),
      'not-json',
      JSON.stringify({ step: 'worker_execution', timestamp: '2026-08-23T10:00:01.000Z' }),
      JSON.stringify({ timestamp: '2026-08-23T10:00:02.000Z' }),
    ];

    const traces = parseAgentAuditJsonl(lines);
    expect(traces.length).toBe(2);
    expect(traces[0].step).toBe('supervisor_turn_start');
    expect(traces[0].messageId).toBe('msg-1');
    expect(traces[1].step).toBe('worker_execution');
    expect(traces[1].purpose).toBe('worker_execution');
  });

  test('preserves metadata and supervisor fields', () => {
    const lines = [
      JSON.stringify({
        step: 'supervisor_delegate',
        timestamp: '2026-08-23T10:00:00.000Z',
        supervisorStep: 1,
        decision: 'delegate',
        metadata: { requestedAgentId: 'productivity_attendant' },
      }),
    ];

    const [trace] = parseAgentAuditJsonl(lines);
    expect(trace.supervisorStep).toBe(1);
    expect(trace.decision).toBe('delegate');
    expect(trace.metadata?.requestedAgentId).toBe('productivity_attendant');
  });
});

// LLM purpose catalog lives in agent-runner — smoke-tested via re-export semantics
import {
  buildLedgerPreview,
  formatPurposeLabel,
  getPurposeMeta,
  resolvePurpose,
} from '../../../nanoclaw/container/agent-runner/src/services/llm-call-purpose.js';

describe('llm-call-purpose orchestrator_supervisor', () => {
  test('resolvePurpose recognizes orchestrator_supervisor', () => {
    expect(resolvePurpose({ purpose: 'orchestrator_supervisor' })).toBe('orchestrator_supervisor');
    expect(resolvePurpose({ preview: 'Supervisor: {"action":"delegate"}' })).toBe('orchestrator_supervisor');
  });

  test('catalog exposes supervisor label and filter kind', () => {
    const meta = getPurposeMeta('orchestrator_supervisor');
    expect(meta.label).toContain('Supervisor');
    expect(meta.runsFilterKind).toBe('supervisor');
    expect(formatPurposeLabel('orchestrator_supervisor', { short: true })).toBe('Supervisor');
  });

  test('buildLedgerPreview prefixes supervisor content', () => {
    expect(buildLedgerPreview('orchestrator_supervisor', '{"action":"finish"}')).toBe(
      'Supervisor: {"action":"finish"}',
    );
  });
});
