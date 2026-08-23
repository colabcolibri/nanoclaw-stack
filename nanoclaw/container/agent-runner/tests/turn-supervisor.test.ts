import { describe, expect, test } from 'bun:test';
import { TurnPlanState } from '../src/orchestrator/turn-plan-state.js';
import { TurnSupervisor } from '../src/orchestrator/turn-supervisor.js';
import type { WorkerResult } from '../src/agents/types.js';

function mockWorkerResult(summary: string): WorkerResult {
  return {
    agentId: 'productivity_attendant',
    status: 'success',
    findings: [],
    summary,
    rawFindingsReport: summary,
    iterations: 1,
    completion: { status: 'sufficient', reason: 'mock' },
  };
}

describe('TurnSupervisor & TurnPlanState', () => {
  test('parseDecision accepts delegate and finish JSON', () => {
    const delegate = TurnSupervisor.parseDecision(
      '{"action":"delegate","agentId":"productivity_attendant","task":"Check inbox","reasoning":"need email"}'
    );
    expect(delegate?.action).toBe('delegate');
    if (delegate?.action === 'delegate') {
      expect(delegate.agentId).toBe('productivity_attendant');
      expect(delegate.task).toContain('inbox');
    }

    const finish = TurnSupervisor.parseDecision(
      '{"action":"finish","guidanceForSender":"Tell user the result","reasoning":"done"}'
    );
    expect(finish?.action).toBe('finish');
  });

  test('TurnPlanState accumulates steps and builds handover sections', () => {
    const state = new TurnPlanState('veja meus emails e atualize agenda se precisar');
    state.appendStep({
      agentId: 'productivity_attendant',
      agentName: 'Gmail',
      departmentId: 'productivity',
      taskDescription: 'List unread emails',
      workerResult: {
        ...mockWorkerResult('3 unread: meeting request Friday'),
        findings: [
          {
            tool: 'google_gmail',
            args: { action: 'list_messages', query: 'is:unread' },
            result: JSON.stringify({ total: 1, messages: [{ subject: 'meeting request Friday' }] }),
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });

    expect(state.steps.length).toBe(1);
    const supervisorView = state.formatForSupervisor();
    expect(supervisorView).toContain('meeting request');
    expect(supervisorView).toContain('google_gmail');
    expect(state.formatPriorStepsForWorker()).toContain('Step 1');
    expect(state.buildTechnicalFindings()).toContain('Gmail');
  });

  test('TurnPlanState toAuditMetadata snapshots steps for agent_audit', () => {
    const state = new TurnPlanState('goal');
    state.appendStep({
      agentId: 'productivity_attendant',
      agentName: 'Gmail',
      departmentId: 'productivity',
      taskDescription: 'List emails',
      workerResult: mockWorkerResult('2 unread'),
    });

    const meta = state.toAuditMetadata();
    expect(meta.stepCount).toBe(1);
    expect(meta.totalFindings).toBe(0);
    expect(Array.isArray(meta.steps)).toBe(true);
  });

  test('resolveMaxSteps respects override and env default', () => {
    expect(TurnSupervisor.resolveMaxSteps(2)).toBe(2);
    expect(TurnSupervisor.resolveMaxSteps()).toBeGreaterThan(0);
  });
});
