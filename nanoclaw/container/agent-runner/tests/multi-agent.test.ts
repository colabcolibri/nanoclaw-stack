import { describe, expect, test, beforeEach } from 'bun:test';
import { AgentRegistry } from '../src/agents/registry.js';
import { WorkerAgentRunner } from '../src/agents/worker-agent.js';
import { SenderAgent } from '../src/agents/sender-agent.js';
import { OrchestratorAgent } from '../src/agents/orchestrator-agent.js';
import { AgentAuditLogger } from '../src/agents/audit-logger.js';
import type { LLMResponse } from '../src/orchestrator/types.js';

describe('Multi-Agent & Department Architecture', () => {
  beforeEach(() => {
    AgentRegistry.initializeDefaults();
    AgentAuditLogger.clear();
  });

  test('AgentRegistry organizes agents cleanly into departments with isolated skills', () => {
    const departments = AgentRegistry.getDepartments();
    expect(departments.length).toBeGreaterThanOrEqual(4);

    const prodDept = AgentRegistry.getDepartment('productivity');
    expect(prodDept).toBeDefined();
    expect(prodDept?.name).toContain('Produtividade');

    const prodAgents = AgentRegistry.getAgentsInDepartment('productivity');
    expect(prodAgents.length).toBeGreaterThanOrEqual(2);

    const gmailAgent = AgentRegistry.getAgent('productivity_attendant');
    expect(gmailAgent).toBeDefined();
    expect(gmailAgent?.agentSkills).toContain('google_gmail');
    expect(gmailAgent?.agentSkills).toContain('google_calendar');

    // Tool isolation: Productivity agent only gets its specific tools + global tools
    const tools = AgentRegistry.getToolsForAgent('productivity_attendant');
    const toolNames = tools.map((t) => t.function.name);
    expect(toolNames).toContain('google_gmail');
    expect(toolNames).toContain('google_calendar');
    expect(toolNames).toContain('retrieve_message_context'); // global tool
    expect(toolNames).not.toContain('yampi_store'); // E-commerce tool MUST NOT leak here!
    expect(toolNames).not.toContain('resale_pricing'); // Pricing tool MUST NOT leak here!
  });

  test('WorkerAgentRunner executes specialist in isolated sandbox and records audit trace', async () => {
    const agent = AgentRegistry.getAgent('store_attendant')!;
    expect(agent).toBeDefined();

    let llmCallCount = 0;
    const mockComplete = async (messages: any[], tools: any, options: any): Promise<LLMResponse> => {
      llmCallCount++;
      expect(options.agent).toBe('store_attendant');
      expect(options.department).toBe('commerce');

      if (llmCallCount === 1) {
        return {
          content: 'Consultando pedidos.',
          tool_calls: [
            {
              id: 'call-yampi-1',
              type: 'function',
              function: {
                name: 'read_file',
                arguments: JSON.stringify({ path: '/tmp/test' }),
              },
            },
          ],
        };
      }

      return {
        content: 'DONE',
      };
    };

    const result = await WorkerAgentRunner.execute(agent, 'Verifique o pedido 12345', mockComplete, '/tmp');
    expect(result.status).toBe('success');
    expect(result.findings.length).toBe(1);
    expect(result.findings[0].tool).toBe('read_file');

    const traces = AgentAuditLogger.getTraces();
    expect(traces.length).toBeGreaterThanOrEqual(1);
    expect(traces[0].step).toBe('worker_execution');
    expect(traces[0].agent).toBe('store_attendant');
  });

  test('SenderAgent absorbs Soul and formats output without infrastructure leakage', async () => {
    let personaIngested = false;
    const mockComplete = async (messages: any[], tools: any, options: any): Promise<LLMResponse> => {
      expect(options.agent).toBe('sender');
      const sys = messages.find((m) => m.role === 'system')?.content || '';
      if (sys.includes('Barão') && sys.includes('Mineiro Sarcástico')) {
        personaIngested = true;
      }
      return {
        content: 'Ô sô, olhei o trem aqui e o pedido tá a caminho de Beagá!',
      };
    };

    const handover = {
      userGoal: 'Qual status do meu pedido?',
      technicalFindings: 'Pedido #9988: Status Enviado, Rastreador BR123456',
      guidanceForSender: 'Informe o cliente sobre o envio.',
      isFastPath: false,
    };

    const result = await SenderAgent.deliver(
      handover,
      {
        prompt: 'Qual status do meu pedido?',
        cwd: '/tmp',
        history: [],
        personaInstructions: '# IDENTIDADE (SOUL)\nVocê é o Barão: Mineiro Sarcástico e refinado.',
      },
      mockComplete
    );

    expect(personaIngested).toBe(true);
    expect(result.deliveredText).toContain('Ô sô, olhei o trem aqui');
    expect(result.deliveredText).not.toContain('Handover');
    expect(result.deliveredText).not.toContain('Scratchpad');
  });

  test('OrchestratorAgent routes pure conversation through Fast-Path directly to Sender', async () => {
    let senderInvoked = false;
    let workerInvoked = false;

    const mockComplete = async (messages: any[], tools: any, options: any): Promise<LLMResponse> => {
      if (options?.agent === 'sender') {
        senderInvoked = true;
      }
      if (options?.purpose === 'stage1_action') {
        workerInvoked = true;
      }
      return {
        content: 'Bom dia, Sergio! Como estão as coisas por aí hoje?',
      };
    };

    const result = await OrchestratorAgent.runTurn(
      mockComplete,
      {
        prompt: 'Bom dia, Barão!',
        cwd: '/tmp',
        history: [],
        personaInstructions: 'Você é o Barão.',
      },
      '## Contexto Temporal: Hoje'
    );

    expect(senderInvoked).toBe(true);
    expect(workerInvoked).toBe(false);
    expect(result.toolsExecutedCount).toBe(0);
    expect(result.deliveredText).toContain('Bom dia, Sergio!');

    const traces = AgentAuditLogger.getTraces();
    const triageTrace = traces.find((t) => t.step === 'orchestrator_triage');
    expect(triageTrace).toBeDefined();
  });

  test('OrchestratorAgent routes domain requests through Department -> Specialist -> Sender', async () => {
    let callStep = 0;
    const mockComplete = async (messages: any[], tools: any, options: any): Promise<LLMResponse> => {
      callStep++;

      if (options?.purpose === 'stage1_action') {
        // Specialist Worker pass
        return {
          content: 'DONE',
          tool_calls: [
            {
              id: 'call-gmail-1',
              type: 'function',
              function: {
                name: 'read_file',
                arguments: JSON.stringify({ path: '/tmp/emails' }),
              },
            },
          ],
        };
      }

      if (options?.purpose === 'stage2_synthesis' || options?.agent === 'sender') {
        // Sender Agent pass
        return {
          content: 'Ô sô, chequei seus e-mails e tem 2 boletos pendentes.',
        };
      }

      // Memo pass
      return { content: 'Checagem de e-mails realizada' };
    };

    const result = await OrchestratorAgent.runTurn(
      mockComplete,
      {
        prompt: 'veja meus e-mails e compromissos de hoje',
        cwd: '/tmp',
        history: [],
        personaInstructions: 'Você é o Barão.',
      },
      '## Contexto Temporal: Hoje'
    );

    expect(result.toolsExecutedCount).toBeGreaterThanOrEqual(1);
    expect(result.deliveredText).toContain('Ô sô, chequei seus e-mails');

    const traces = AgentAuditLogger.getTraces();
    expect(traces.some((t) => t.step === 'department_routing')).toBe(true);
    expect(traces.some((t) => t.step === 'agent_selection')).toBe(true);
    expect(traces.some((t) => t.step === 'worker_execution')).toBe(true);
    expect(traces.some((t) => t.step === 'orchestrator_evaluation')).toBe(true);
    expect(traces.some((t) => t.step === 'sender_synthesis')).toBe(true);
  });
});
