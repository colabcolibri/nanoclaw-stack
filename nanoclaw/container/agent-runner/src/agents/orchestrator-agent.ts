import { AgentRegistry } from './registry.js';
import { SenderAgent } from './sender-agent.js';
import { AgentAuditLogger } from './audit-logger.js';
import { MemoService } from '../services/memo-service.js';
import { ModelRegistry } from '../services/model-registry.js';
import { PromptLoader } from '../services/prompt-loader.js';
import {
  ContextPack,
  DEFAULT_FAST_CONTEXT_PLAN,
  type ContextPlan,
} from '../services/context-pack.js';
import type { MultiAgentTurnOptions, HandoverPackage, RoutingDecision } from './types.js';
import type { LLMCompletionFn, OrchestratorResult, ConversationMemoEntry } from '../orchestrator/types.js';
import { TurnSupervisor } from '../orchestrator/turn-supervisor.js';

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

    const routing = await this.resolveRouting(
      complete,
      prompt,
      orchestratorModel,
      options.cwd,
      options.messageId ?? options.inboundMessageIds?.[0],
      onActivity
    );

    if (routing.type === 'fast_path') {
      const handover: HandoverPackage = {
        userGoal: prompt,
        technicalFindings: '(No tools needed to be executed)',
        guidanceForSender: routing.instructionsForSender || 'Reply directly in character.',
        isFastPath: true,
        contextPlan: routing.contextPlan ?? DEFAULT_FAST_CONTEXT_PLAN,
      };

      const { deliveredText, rawContent } = await SenderAgent.deliver(
        handover,
        buildSenderContext(options, temporalContext, senderModel, prompt),
        complete,
        onActivity
      );

      return this.finalizeTurnResult({
        prompt,
        deliveredText,
        rawContent,
        options,
        senderModel,
        complete,
        toolsExecutedCount: 0,
      });
    }

    const selectedDeptId = routing.departmentId;
    const departments = AgentRegistry.getDepartments(options.cwd);
    const dept = departments.find((d) => d.id === selectedDeptId) || departments[0];

    AgentAuditLogger.record(options.cwd, {
      step: 'department_routing',
      agent: 'orchestrator',
      department: selectedDeptId,
      messageId: options.messageId ?? options.inboundMessageIds?.[0],
      purpose: `LLM routing to department: ${dept?.name || selectedDeptId}`,
      latencyMs: 0,
      promptPreview: prompt.slice(0, 100),
      timestamp: new Date().toISOString(),
    });

    const { handover, toolsExecutedCount } = await TurnSupervisor.runDelegation({
      userGoal: prompt,
      cwd: options.cwd,
      complete,
      orchestratorModel,
      routing,
      maxSupervisorSteps: options.maxSupervisorSteps,
      maxWorkerIterations: options.maxWorkerIterations,
      defaultModel: options.defaultModel,
      history: options.history,
      messageId: options.messageId ?? options.inboundMessageIds?.[0],
      onActivity,
    });

    const { deliveredText, rawContent } = await SenderAgent.deliver(
      handover,
      buildSenderContext(options, temporalContext, senderModel, prompt),
      complete,
      onActivity
    );

    return this.finalizeTurnResult({
      prompt,
      deliveredText,
      rawContent,
      options,
      senderModel,
      complete,
      toolsExecutedCount,
    });
  }

  private static createMemoGenerator(senderModel: string, complete: LLMCompletionFn) {
    return (content: string) =>
      MemoService.generateSemanticMemo(content, async (sys, usr) => {
        const resp = await complete(
          [{ role: 'system', content: sys }, { role: 'user', content: usr }],
          false,
          { purpose: 'semantic_memo', model: senderModel }
        );
        return resp.content || '';
      });
  }

  private static normalizeHistoryEntry(
    entry: { role: string; memo?: string; content?: string; [key: string]: any }
  ): ConversationMemoEntry | null {
    const role = entry.role === 'assistant' ? 'assistant' : 'user';
    const memo =
      (typeof entry.memo === 'string' && entry.memo.trim()) ||
      (typeof entry.content === 'string' && entry.content.trim()
        ? MemoService.extractMemo(entry.content)
        : '');
    if (!memo) return null;
    return { role, memo };
  }

  private static async finalizeTurnResult(params: {
    prompt: string;
    deliveredText: string;
    rawContent: string;
    options: MultiAgentTurnOptions;
    senderModel: string;
    complete: LLMCompletionFn;
    toolsExecutedCount: number;
  }): Promise<OrchestratorResult> {
    const generateMemo = this.createMemoGenerator(params.senderModel, params.complete);
    const [userMemo, assistantMemo] = await Promise.all([
      generateMemo(params.prompt),
      generateMemo(params.rawContent || params.deliveredText),
    ]);

    if (params.options.inboundMessageIds?.length) {
      for (const id of params.options.inboundMessageIds) {
        MemoService.updateInboundMemo(id, userMemo);
      }
    }

    const historyLimit = params.options.historyLimit || 10;
    const priorHistory = params.options.history
      .map((entry) => this.normalizeHistoryEntry(entry))
      .filter((entry): entry is ConversationMemoEntry => entry !== null);

    const updatedHistory: ConversationMemoEntry[] = [
      ...priorHistory,
      { role: 'user' as const, memo: userMemo },
      { role: 'assistant' as const, memo: assistantMemo },
    ].slice(-historyLimit);

    return {
      deliveredText: params.deliveredText,
      updatedHistory,
      toolsExecutedCount: params.toolsExecutedCount,
      userMemo,
      assistantMemo,
    };
  }

  private static buildCompactCatalog(cwd?: string): string {
    return AgentRegistry.getDepartments(cwd)
      .map((dept) => {
        const agents = AgentRegistry.getAgentsInDepartment(dept.id, cwd);
        const agentIds = agents.map((a) => a.id).join(', ') || '(none)';
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
        reasoning: parsed.reasoning || 'Direct conversation',
        instructionsForSender: parsed.instructionsForSender || 'Reply directly in character.',
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
    messageId: string | undefined,
    onActivity?: () => void
  ): Promise<RoutingDecision & { taskDescription?: string }> {
    const catalog = this.buildCompactCatalog(cwd);
    const memoIndex = ContextPack.formatMemoIndex(8);

    const systemPrompt =
      PromptLoader.load('orchestrator.triage', { CATALOG: catalog }) ||
      `Route the message. Catalog:\n${catalog}`;

    const userPrompt = `## Current message\n${prompt}\n\n## Recent memo index\n${memoIndex}`;

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
            messageId,
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
            messageId,
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
      messageId,
      purpose: `LLM triage fallback: fast_path (parse failed)`,
      latencyMs: Date.now() - startTime,
      responsePreview: 'Triage inconclusive — safe route to sender',
      timestamp: new Date().toISOString(),
    });

    return {
      type: 'fast_path',
      reasoning: 'Triage inconclusive; sender replies with minimal context.',
      instructionsForSender: 'Reply politely in character; do not invent technical data.',
      contextPlan: DEFAULT_FAST_CONTEXT_PLAN,
    };
  }
}
