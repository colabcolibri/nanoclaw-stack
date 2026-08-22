import { AgentRegistry } from './registry.js';
import { WorkerAgentRunner } from './worker-agent.js';
import { SenderAgent } from './sender-agent.js';
import { AgentAuditLogger } from './audit-logger.js';
import { MemoService } from '../services/memo-service.js';
import { ModelRegistry } from '../services/model-registry.js';
import { PromptLoader } from '../services/prompt-loader.js';
import {
  ContextPack,
  DEFAULT_FAST_CONTEXT_PLAN,
  DEFAULT_SYNTHESIS_CONTEXT_PLAN,
  type ContextPlan,
} from '../services/context-pack.js';
import type { MultiAgentTurnOptions, HandoverPackage, RoutingDecision, SpecialistAgent } from './types.js';
import type { LLMCompletionFn, OrchestratorResult } from '../orchestrator/types.js';

function parseContextPlan(raw: unknown): ContextPlan | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const plan = raw as Record<string, unknown>;
  const memoIds = Array.isArray(plan.memoIds)
    ? plan.memoIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : undefined;
  const includeMemoryIndex =
    typeof plan.includeMemoryIndex === 'boolean' ? plan.includeMemoryIndex : undefined;
  const soulMode = plan.soulMode === 'full' || plan.soulMode === 'compact' ? plan.soulMode : undefined;

  if (!memoIds && includeMemoryIndex === undefined && !soulMode) return undefined;
  return { memoIds, includeMemoryIndex, soulMode };
}

function buildSenderContext(
  options: MultiAgentTurnOptions,
  temporalContext: string,
  senderModel: string,
  prompt: string
) {
  return {
    prompt,
    chatJid: options.chatJid,
    cwd: options.cwd,
    history: options.history,
    personaInstructions: options.personaInstructions,
    coreMemory: options.coreMemory,
    temporalContext,
    senderModel,
    defaultModel: options.defaultModel,
  };
}

export class OrchestratorAgent {
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

    const routing = await this.resolveRouting(complete, prompt, orchestratorModel, options.cwd, onActivity);

    if (routing.type === 'fast_path') {
      const handover: HandoverPackage = {
        userGoal: prompt,
        technicalFindings: '(No tools needed to be executed)',
        guidanceForSender: routing.instructionsForSender || 'Responda diretamente na persona.',
        isFastPath: true,
        contextPlan: routing.contextPlan ?? DEFAULT_FAST_CONTEXT_PLAN,
      };

      const { deliveredText, rawContent } = await SenderAgent.deliver(
        handover,
        buildSenderContext(options, temporalContext, senderModel, prompt),
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
        contextPlan: routing.contextPlan ?? DEFAULT_FAST_CONTEXT_PLAN,
      };
      const { deliveredText, rawContent } = await SenderAgent.deliver(
        handover,
        buildSenderContext(options, temporalContext, senderModel, prompt),
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

    const handover: HandoverPackage = {
      userGoal: prompt,
      technicalFindings: workerResult.rawFindingsReport,
      workerSummary: workerResult.summary,
      guidanceForSender: `O especialista [${selectedAgent.name}] concluiu a busca técnica. Sintetize as informações com clareza.`,
      isFastPath: false,
      contextPlan: routing.contextPlan ?? DEFAULT_SYNTHESIS_CONTEXT_PLAN,
    };

    AgentAuditLogger.record(options.cwd, {
      step: 'orchestrator_evaluation',
      agent: 'orchestrator',
      purpose: `Quality gate passed. ${workerResult.findings.length} findings gathered by ${selectedAgent.id}.`,
      latencyMs: 0,
      responsePreview: workerResult.summary.slice(0, 100),
      timestamp: new Date().toISOString(),
    });

    const { deliveredText, rawContent } = await SenderAgent.deliver(
      handover,
      buildSenderContext(options, temporalContext, senderModel, prompt),
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

  private static buildCompactCatalog(): string {
    return AgentRegistry.getDepartments()
      .map((dept) => {
        const agents = AgentRegistry.getAgentsInDepartment(dept.id);
        const agentIds = agents.map((a) => a.id).join(', ') || '(nenhum)';
        const keywords = dept.keywords.slice(0, 6).join(', ');
        return `- ${dept.id}: [${keywords}] → ${agentIds}`;
      })
      .join('\n');
  }

  private static parseRoutingPayload(
    raw: string
  ): (RoutingDecision & { taskDescription?: string }) | null {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    const contextPlan = parseContextPlan(parsed.contextPlan);

    if (parsed.type === 'fast_path') {
      return {
        type: 'fast_path',
        reasoning: parsed.reasoning || 'Conversa direta',
        instructionsForSender: parsed.instructionsForSender || 'Responda diretamente na persona.',
        contextPlan,
      };
    }

    if (parsed.type === 'department_delegation' && parsed.departmentId) {
      return {
        type: 'department_delegation',
        reasoning: parsed.reasoning || 'Delegação por LLM',
        departmentId: parsed.departmentId,
        agentId: parsed.agentId,
        taskDescription: parsed.taskDescription || '',
        contextPlan,
      };
    }

    return null;
  }

  private static async resolveRouting(
    complete: LLMCompletionFn,
    prompt: string,
    orchestratorModel: string,
    cwd: string,
    onActivity?: () => void
  ): Promise<RoutingDecision & { taskDescription?: string }> {
    const catalog = this.buildCompactCatalog();
    const memoIndex = ContextPack.formatMemoIndex(8);

    const systemPrompt =
      PromptLoader.load('orchestrator.triage', { CATALOG: catalog }) ||
      `Roteie a mensagem. Catálogo:\n${catalog}`;

    const userPrompt = `## Mensagem atual\n${prompt}\n\n## Índice de memos recentes\n${memoIndex}`;

    onActivity?.();
    const startTime = Date.now();

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await complete(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          false,
          {
            purpose: 'orchestrator_triage',
            agent: 'orchestrator',
            model: orchestratorModel,
            triageAttempt: attempt + 1,
          }
        );

        const latencyMs = Date.now() - startTime;
        const raw = (response.content || '').trim();
        const routing = this.parseRoutingPayload(raw);

        if (routing) {
          AgentAuditLogger.record(cwd, {
            step: 'orchestrator_triage',
            agent: 'orchestrator',
            purpose: `LLM triage (${orchestratorModel}): ${routing.type}`,
            latencyMs,
            responsePreview: routing.reasoning?.slice(0, 100),
            timestamp: new Date().toISOString(),
          });
          if (routing.type === 'department_delegation' && !routing.taskDescription) {
            routing.taskDescription = prompt;
          }
          return routing;
        }
      } catch {
        // retry
      }
    }

    AgentAuditLogger.record(cwd, {
      step: 'orchestrator_triage',
      agent: 'orchestrator',
      purpose: `LLM triage fallback: fast_path (parse failed)`,
      latencyMs: Date.now() - startTime,
      responsePreview: 'Triagem inconclusiva — rota segura para sender',
      timestamp: new Date().toISOString(),
    });

    return {
      type: 'fast_path',
      reasoning: 'Triagem inconclusiva; sender responde com contexto mínimo.',
      instructionsForSender: 'Responda com cordialidade na persona, sem inventar dados técnicos.',
      contextPlan: DEFAULT_FAST_CONTEXT_PLAN,
    };
  }
}
