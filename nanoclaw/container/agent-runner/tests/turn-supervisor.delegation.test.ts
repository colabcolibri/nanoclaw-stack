import { describe, expect, test, beforeEach, mock } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AgentRegistry } from '../src/agents/registry.js';
import { AgentAuditLogger } from '../src/agents/audit-logger.js';
import { ModelRegistry } from '../src/services/model-registry.js';
import { WorkerAgentRunner } from '../src/agents/worker-agent.js';
import { TurnSupervisor } from '../src/orchestrator/turn-supervisor.js';
import type { LLMResponse } from '../src/orchestrator/types.js';
import type { WorkerResult } from '../src/agents/types.js';

const TEST_MODEL = 'deepseek-chat';

function seedTestCatalog(): void {
  ModelRegistry.seedForTests([
    {
      id: TEST_MODEL,
      name: 'DeepSeek Chat',
      providerId: 'deepseek',
      description: 'Test model',
      completionUrl: 'https://api.deepseek.com/chat/completions',
      keyEnvName: 'DEEPSEEK_API_KEY',
      protocol: 'openai-compatible',
      inferenceParams: {},
      contextWindow: '128k',
      pricing: { cacheHitPerMillion: 0, cacheMissPerMillion: 0, outputPerMillion: 0 },
    },
  ]);
}

const routing = {
  type: 'department_delegation' as const,
  departmentId: 'productivity',
  agentId: 'productivity_attendant',
  taskDescription: 'Check inbox',
  reasoning: 'email task',
};

describe('TurnSupervisor.runDelegation', () => {
  let tmpDir: string;
  let supervisorCalls: number;
  let workerCalls: number;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-supervisor-'));
    ModelRegistry.resetForTests();
    seedTestCatalog();
    AgentRegistry.initializeDefaults();
    AgentRegistry.discoverAgents();
    AgentAuditLogger.clear();
    supervisorCalls = 0;
    workerCalls = 0;
  });

  test('delegate then finish records full supervisor audit timeline', async () => {
    const mockComplete = async (_messages: unknown[], _tools: unknown, options: { purpose?: string }): Promise<LLMResponse> => {
      if (options.purpose === 'orchestrator_supervisor') {
        supervisorCalls++;
        if (supervisorCalls === 1) {
          return {
            content: JSON.stringify({
              action: 'delegate',
              agentId: 'productivity_attendant',
              task: 'List unread emails',
              reasoning: 'need inbox',
            }),
          };
        }
        return {
          content: JSON.stringify({
            action: 'finish',
            guidanceForSender: 'Summarize emails for user',
            reasoning: 'done',
          }),
        };
      }

      if (options.purpose === 'stage1_action') {
        workerCalls++;
        return { content: 'DONE — 2 unread emails' };
      }

      return { content: '{}' };
    };

    const result = await TurnSupervisor.runDelegation({
      userGoal: 'veja meus emails',
      cwd: tmpDir,
      complete: mockComplete,
      orchestratorModel: TEST_MODEL,
      routing,
      maxSupervisorSteps: 2,
      maxWorkerIterations: 2,
      defaultModel: TEST_MODEL,
      messageId: 'inbound-abc',
    });

    expect(result.supervisorSteps).toBe(1);
    expect(result.handover.isFastPath).toBe(false);
    expect(result.handover.technicalFindings).toContain('productivity_attendant');
    expect(workerCalls).toBeGreaterThanOrEqual(1);
    expect(supervisorCalls).toBe(2);

    const steps = AgentAuditLogger.getTraces().map((t) => t.step);
    expect(steps).toContain('supervisor_turn_start');
    expect(steps).toContain('orchestrator_supervisor');
    expect(steps).toContain('supervisor_delegate');
    expect(steps).toContain('agent_selection');
    expect(steps).toContain('worker_execution');
    expect(steps).toContain('orchestrator_evaluation');
    expect(steps).toContain('supervisor_finish');
    expect(steps).toContain('supervisor_turn_summary');

    const summary = AgentAuditLogger.getTraces().find((t) => t.step === 'supervisor_turn_summary');
    expect(summary?.messageId).toBe('inbound-abc');
    expect(summary?.metadata?.outcome).toBe('complete');

    const logPath = path.join(tmpDir, 'logs', 'agent_audit.jsonl');
    expect(fs.existsSync(logPath)).toBe(true);
    expect(fs.readFileSync(logPath, 'utf-8')).toContain('supervisor_turn_summary');
  });

  test('no specialists registered writes no_agents summary', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-empty-'));
    const discoverSpy = mock(() => {});
    const originalDiscover = AgentRegistry.discoverAgents;
    const originalGetAll = AgentRegistry.getAllAgents;

    AgentRegistry.discoverAgents = discoverSpy;
    AgentRegistry.getAllAgents = () => [];

    try {
      const result = await TurnSupervisor.runDelegation({
        userGoal: 'hello',
        cwd: emptyDir,
        complete: async () => ({ content: '{}' }),
        orchestratorModel: TEST_MODEL,
        routing,
        messageId: 'msg-empty',
      });

      expect(result.supervisorSteps).toBe(0);
      expect(result.handover.isFastPath).toBe(true);

      const summary = AgentAuditLogger.getTraces().find((t) => t.step === 'supervisor_turn_summary');
      expect(summary?.metadata?.outcome).toBe('no_agents');
    } finally {
      AgentRegistry.discoverAgents = originalDiscover;
      AgentRegistry.getAllAgents = originalGetAll;
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  test('buildDelegateTask injects prior step context on second delegation', async () => {
    const delegatedTasks: string[] = [];

    const originalExecute = WorkerAgentRunner.execute;
    WorkerAgentRunner.execute = async (_agent, task) => {
      delegatedTasks.push(task);
      const workerResult: WorkerResult = {
        agentId: 'productivity_attendant',
        status: 'success',
        findings: [],
        summary: 'step done',
        rawFindingsReport: 'step done',
        iterations: 1,
      };
      return workerResult;
    };

    let supervisorCall = 0;
    const mockComplete = async (_m: unknown[], _t: unknown, options: { purpose?: string }): Promise<LLMResponse> => {
      if (options.purpose !== 'orchestrator_supervisor') {
        return { content: 'DONE' };
      }
      supervisorCall++;
      if (supervisorCall <= 2) {
        return {
          content: JSON.stringify({
            action: 'delegate',
            agentId: 'productivity_attendant',
            task: `task round ${supervisorCall}`,
          }),
        };
      }
      return {
        content: JSON.stringify({
          action: 'finish',
          guidanceForSender: 'wrap up',
        }),
      };
    };

    try {
      await TurnSupervisor.runDelegation({
        userGoal: 'emails then calendar',
        cwd: tmpDir,
        complete: mockComplete,
        orchestratorModel: TEST_MODEL,
        routing,
        maxSupervisorSteps: 3,
        defaultModel: TEST_MODEL,
      });

      expect(delegatedTasks.length).toBe(2);
      expect(delegatedTasks[1]).toContain('Context from prior steps this turn');
      expect(delegatedTasks[1]).toContain('task round 1');
    } finally {
      WorkerAgentRunner.execute = originalExecute;
    }
  });
});
