import { AgentRegistry } from './registry.js';
import { WorkerAgentRunner } from './worker-agent.js';
import { SenderAgent } from './sender-agent.js';
import { AgentAuditLogger } from './audit-logger.js';
import { MemoService } from '../services/memo-service.js';
import { ToolRouter } from '../tools/router.js';
import { ModelRegistry } from '../services/model-registry.js';
import type { MultiAgentTurnOptions, HandoverPackage, RoutingDecision, SpecialistAgent } from './types.js';
import type { LLMCompletionFn, OrchestratorResult } from '../orchestrator/types.js';

export class OrchestratorAgent {
  /**
   * Orchestrates the hierarchical multi-agent turn:
   * 1. LLM Triage & Department Reasoning (orchestratorModel)
   * 2. Specialist Agent Selection inside the chosen Department
   * 3. Worker Execution with isolated agent-skills
   * 4. Quality Gate & Handover packaging
   * 5. Sender Agent Synthesis (Soul)
   */
  static async runTurn(
    complete: LLMCompletionFn,
    options: MultiAgentTurnOptions,
    temporalContext: string,
    onActivity?: () => void
  ): Promise<OrchestratorResult> {
    const prompt = options.prompt.trim();
    const orchestratorModel = ModelRegistry.requireModelId(
      options.orchestratorModel,
      'orchestratorModel',
      options.cwd,
    );
    const senderModel = ModelRegistry.requireModelId(options.senderModel, 'senderModel', options.cwd);

    // 1. LLM Triage — decide fast-path vs department delegation
    const routing = await this.resolveRouting(complete, prompt, orchestratorModel, options.cwd, onActivity);

    if (routing.type === 'fast_path') {
      AgentAuditLogger.record(options.cwd, {
        step: 'orchestrator_triage',
        agent: 'orchestrator',
        purpose: `LLM triage: fast-path — ${routing.reasoning}`,
        latencyMs: 0,
        promptPreview: prompt.slice(0, 100),
        responsePreview: 'Direct route to Sender Agent',
        timestamp: new Date().toISOString(),
      });

      const handover: HandoverPackage = {
        userGoal: prompt,
        technicalFindings: '(No tools needed to be executed)',
        guidanceForSender: routing.instructionsForSender || 'Responda diretamente na persona.',
        isFastPath: true,
      };

      const { deliveredText, rawContent } = await SenderAgent.deliver(
        handover,
        {
          prompt,
          chatJid: options.chatJid,
          cwd: options.cwd,
          history: options.history,
          personaInstructions: options.personaInstructions,
          coreMemory: options.coreMemory,
          temporalContext,
          senderModel,
          defaultModel: options.defaultModel,
        },
        complete,
        onActivity
      );

      const memo = await MemoService.generateSemanticMemo(rawContent, async (sys, usr) => {
        const resp = await complete(
          [{ role: 'system', content: sys }, { role: 'user', content: usr }],
          false,
          { purpose: 'semantic_memo', model: senderModel }
        );
        return resp.content || '';
      });

      const historyLimit = options.historyLimit || 10;
      const updatedHistory = [
        ...options.history,
        { role: 'user', content: prompt },
        { role: 'assistant', content: deliveredText },
      ].slice(-historyLimit);

      return { deliveredText, updatedHistory, toolsExecutedCount: 0, memo };
    }

    // 2. Department & Specialist selection from LLM routing (with heuristic fallback)
    const selectedDeptId = routing.departmentId;
    const departments = AgentRegistry.getDepartments();
    const dept = departments.find((d) => d.id === selectedDeptId) || departments[0];

    AgentAuditLogger.record(options.cwd, {
      step: 'department_routing',
      agent: 'orchestrator',
      department: selectedDeptId,
      purpose: `LLM routing to department: ${dept?.name || selectedDeptId}`,
      latencyMs: 0,
      promptPreview: prompt.slice(0, 100),
      timestamp: new Date().toISOString(),
    });

    const deptAgents = AgentRegistry.getAgentsInDepartment(selectedDeptId);
    let selectedAgent: SpecialistAgent | undefined =
      (routing.agentId ? AgentRegistry.getAgent(routing.agentId) : null) ||
      deptAgents[0] ||
      AgentRegistry.getAllAgents()[0];

    if (!selectedAgent) {
      const handover: HandoverPackage = {
        userGoal: prompt,
        technicalFindings: '(Nenhum agente especialista registrado no sistema)',
        guidanceForSender: 'Informe ao usuário que não há especialistas disponíveis no momento.',
        isFastPath: true,
      };
      const { deliveredText, rawContent } = await SenderAgent.deliver(
        handover,
        {
          prompt,
          chatJid: options.chatJid,
          cwd: options.cwd,
          history: options.history,
          personaInstructions: options.personaInstructions,
          coreMemory: options.coreMemory,
          temporalContext,
          senderModel,
          defaultModel: options.defaultModel,
        },
        complete,
        onActivity
      );
      const historyLimit = options.historyLimit || 10;
      return {
        deliveredText,
        updatedHistory: [
          ...options.history,
          { role: 'user', content: prompt },
          { role: 'assistant', content: deliveredText },
        ].slice(-historyLimit),
        toolsExecutedCount: 0,
      };
    }

    AgentAuditLogger.record(options.cwd, {
      step: 'agent_selection',
      agent: selectedAgent.id,
      department: selectedDeptId,
      purpose: `Selected specialist: ${selectedAgent.id} (${selectedAgent.name})`,
      latencyMs: 0,
      promptPreview: prompt.slice(0, 100),
      timestamp: new Date().toISOString(),
    });

    // 3. Worker Execution with isolated tools & skills
    const workerResult = await WorkerAgentRunner.execute(
      selectedAgent,
      routing.taskDescription || prompt,
      complete,
      options.cwd,
      {
        maxIterations: options.maxWorkerIterations || 6,
        onActivity,
        history: options.history,
        defaultModel: options.defaultModel,
      }
    );

    // 4. Quality Gate & Handover Packaging
    const handover: HandoverPackage = {
      userGoal: prompt,
      technicalFindings: workerResult.rawFindingsReport,
      workerSummary: workerResult.summary,
      guidanceForSender: `O especialista [${selectedAgent.name}] concluiu a busca técnica. Sintetize as informações com clareza.`,
      isFastPath: false,
    };

    AgentAuditLogger.record(options.cwd, {
      step: 'orchestrator_evaluation',
      agent: 'orchestrator',
      purpose: `Quality gate passed. ${workerResult.findings.length} findings gathered by ${selectedAgent.id}.`,
      latencyMs: 0,
      responsePreview: workerResult.summary.slice(0, 100),
      timestamp: new Date().toISOString(),
    });

    // 5. Sender Agent Delivery (Soul Synthesis)
    const { deliveredText, rawContent } = await SenderAgent.deliver(
      handover,
      {
        prompt,
        chatJid: options.chatJid,
        cwd: options.cwd,
        history: options.history,
        personaInstructions: options.personaInstructions,
        coreMemory: options.coreMemory,
        temporalContext,
        senderModel,
        defaultModel: options.defaultModel,
      },
      complete,
      onActivity
    );

    const memo = await MemoService.generateSemanticMemo(rawContent, async (sys, usr) => {
      const resp = await complete(
        [{ role: 'system', content: sys }, { role: 'user', content: usr }],
        false,
        { purpose: 'semantic_memo', model: senderModel }
      );
      return resp.content || '';
    });

    const historyLimit = options.historyLimit || 10;
    const updatedHistory = [
      ...options.history,
      { role: 'user', content: prompt },
      { role: 'assistant', content: deliveredText },
    ].slice(-historyLimit);

    return {
      deliveredText,
      updatedHistory,
      toolsExecutedCount: workerResult.findings.length,
      memo,
    };
  }

  /**
   * LLM-powered triage with heuristic fallback.
   * Uses orchestratorModel to decide fast-path vs department delegation.
   */
  private static async resolveRouting(
    complete: LLMCompletionFn,
    prompt: string,
    orchestratorModel: string,
    cwd: string,
    onActivity?: () => void
  ): Promise<RoutingDecision & { taskDescription?: string }> {
    const departments = AgentRegistry.getDepartments();
    const catalog = departments
      .map((dept) => {
        const agents = AgentRegistry.getAgentsInDepartment(dept.id);
        const agentList = agents
          .map((a) => `    - id: ${a.id}, name: ${a.name}, skills: [${a.agentSkills.join(', ')}]`)
          .join('\n');
        return `  - id: ${dept.id}, name: ${dept.name}, keywords: [${dept.keywords.join(', ')}]\n    agents:\n${agentList}`;
      })
      .join('\n');

    const systemPrompt = `Você é o Orquestrador de um sistema multi-agente.
Analise a solicitação do usuário e decida o roteamento.

Departamentos e agentes disponíveis:
${catalog}

Responda APENAS com JSON válido (sem markdown), em um destes formatos:

Para conversa pura (saudações, perguntas gerais, orientação sem ferramentas):
{"type":"fast_path","reasoning":"...","instructionsForSender":"..."}

Para tarefas que exigem ferramentas ou especialistas:
{"type":"department_delegation","reasoning":"...","departmentId":"...","agentId":"...","taskDescription":"..."}`;

    onActivity?.();
    const startTime = Date.now();

    try {
      const response = await complete(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        false,
        { purpose: 'orchestrator_triage', agent: 'orchestrator', model: orchestratorModel }
      );

      const latencyMs = Date.now() - startTime;
      const raw = (response.content || '').trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.type === 'fast_path') {
          AgentAuditLogger.record(cwd, {
            step: 'orchestrator_triage',
            agent: 'orchestrator',
            purpose: `LLM triage (${orchestratorModel}): fast_path`,
            latencyMs,
            responsePreview: parsed.reasoning?.slice(0, 100),
            timestamp: new Date().toISOString(),
          });
          return {
            type: 'fast_path',
            reasoning: parsed.reasoning || 'Conversa direta',
            instructionsForSender: parsed.instructionsForSender || 'Responda diretamente na persona.',
          };
        }
        if (parsed.type === 'department_delegation' && parsed.departmentId) {
          AgentAuditLogger.record(cwd, {
            step: 'orchestrator_triage',
            agent: 'orchestrator',
            purpose: `LLM triage (${orchestratorModel}): delegate to ${parsed.departmentId}/${parsed.agentId || 'auto'}`,
            latencyMs,
            responsePreview: parsed.reasoning?.slice(0, 100),
            timestamp: new Date().toISOString(),
          });
          return {
            type: 'department_delegation',
            reasoning: parsed.reasoning || 'Delegação por LLM',
            departmentId: parsed.departmentId,
            agentId: parsed.agentId,
            taskDescription: parsed.taskDescription || prompt,
          };
        }
      }
    } catch {
      // Fall through to heuristic fallback
    }

    return this.heuristicRouting(prompt);
  }

  /** Keyword-based fallback when LLM triage fails or returns invalid JSON. */
  private static heuristicRouting(prompt: string): RoutingDecision & { taskDescription?: string } {
    const routedTools = ToolRouter.selectTools(prompt);
    const normalizedPrompt = prompt.toLowerCase();

    if (routedTools.length === 0) {
      return {
        type: 'fast_path',
        reasoning: 'Heuristic: no tools detected',
        instructionsForSender: 'Responda diretamente na persona.',
      };
    }

    let selectedDeptId = 'productivity';
    const departments = AgentRegistry.getDepartments();
    for (const dept of departments) {
      if (dept.keywords.some((kw) => normalizedPrompt.includes(kw))) {
        selectedDeptId = dept.id;
        break;
      }
    }

    const deptAgents = AgentRegistry.getAgentsInDepartment(selectedDeptId);
    let selectedAgentId = deptAgents[0]?.id;

    for (const ag of deptAgents) {
      if (
        ag.agentSkills.some((s) => normalizedPrompt.includes(s.replace(/_/g, ' '))) ||
        ag.description.toLowerCase().split(' ').some((w) => w.length > 4 && normalizedPrompt.includes(w))
      ) {
        selectedAgentId = ag.id;
        break;
      }
    }

    return {
      type: 'department_delegation',
      reasoning: 'Heuristic fallback: keyword matching',
      departmentId: selectedDeptId,
      agentId: selectedAgentId,
      taskDescription: prompt,
    };
  }
}
