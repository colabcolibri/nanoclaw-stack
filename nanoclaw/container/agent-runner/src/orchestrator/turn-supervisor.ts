import { AgentRegistry } from '../agents/registry.js';
import { WorkerAgentRunner } from '../agents/worker-agent.js';
import { AgentAuditLogger } from '../agents/audit-logger.js';
import { PromptLoader } from '../services/prompt-loader.js';
import { DEFAULT_SYNTHESIS_CONTEXT_PLAN } from '../services/context-pack.js';
import type { DepartmentDelegationDecision, HandoverPackage, SpecialistAgent } from '../agents/types.js';
import type { LLMCompletionFn } from './types.js';
import { TurnPlanState } from './turn-plan-state.js';
import { SupervisorPolicy } from '../execution/supervisor-policy.js';
import { ExecutionProfiles } from '../execution/profiles.js';

export type SupervisorDecision =
  | { action: 'delegate'; agentId: string; task: string; reasoning?: string }
  | { action: 'finish'; guidanceForSender: string; reasoning?: string };

export interface TurnSupervisorOptions {
  userGoal: string;
  cwd: string;
  complete: LLMCompletionFn;
  orchestratorModel: string;
  routing: DepartmentDelegationDecision;
  maxSupervisorSteps?: number;
  maxWorkerIterations?: number;
  defaultModel?: string;
  history?: any[];
  messageId?: string;
  onActivity?: () => void;
}

export interface TurnSupervisorResult {
  handover: HandoverPackage;
  toolsExecutedCount: number;
  supervisorSteps: number;
}

export class TurnSupervisor {
  static resolveMaxSteps(override?: number): number {
    if (override && override > 0) return override;
    const fromEnv = parseInt(process.env.SUPERVISOR_MAX_STEPS || '4', 10);
    return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 4;
  }

  static parseDecision(raw: string): SupervisorDecision | null {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.action === 'finish') {
        return {
          action: 'finish',
          guidanceForSender:
            typeof parsed.guidanceForSender === 'string'
              ? parsed.guidanceForSender
              : 'Synthesize the verified findings for the user.',
          reasoning: parsed.reasoning,
        };
      }
      if (parsed.action === 'delegate' && typeof parsed.agentId === 'string' && parsed.agentId.trim()) {
        return {
          action: 'delegate',
          agentId: parsed.agentId.trim(),
          task: typeof parsed.task === 'string' && parsed.task.trim() ? parsed.task.trim() : '',
          reasoning: parsed.reasoning,
        };
      }
    } catch {
      return null;
    }
    return null;
  }

  private static buildCatalog(cwd: string): string {
    return AgentRegistry.getDepartments(cwd)
      .map((dept) => {
        const agents = AgentRegistry.getAgentsInDepartment(dept.id, cwd);
        const agentIds = agents.map((a) => a.id).join(', ') || '(none)';
        return `- ${dept.id}: ${agentIds}`;
      })
      .join('\n');
  }

  private static buildTriageHint(routing: DepartmentDelegationDecision): string {
    const parts = [
      `departmentId: ${routing.departmentId}`,
      routing.agentId ? `agentId: ${routing.agentId}` : null,
      routing.taskDescription ? `task: ${routing.taskDescription}` : null,
      routing.reasoning ? `reasoning: ${routing.reasoning}` : null,
    ].filter(Boolean);
    return parts.join('\n');
  }

  private static resolveAgent(agentId: string, departmentId: string | undefined, cwd: string): SpecialistAgent | null {
    const byId = AgentRegistry.getAgent(agentId, cwd);
    if (byId) return byId;

    if (departmentId) {
      const inDept = AgentRegistry.getAgentsInDepartment(departmentId, cwd);
      if (inDept.length > 0) return inDept[0];
    }

    return AgentRegistry.getAllAgents(cwd)[0] ?? null;
  }

  private static buildDelegateTask(task: string, state: TurnPlanState): string {
    const base = task.trim() || state.userGoal;
    const prior = state.formatPriorStepsForWorker();
    if (!prior) return base;
    return `${base}\n\n## Context from prior steps this turn\n${prior}`;
  }

  private static audit(cwd: string, trace: Parameters<typeof AgentAuditLogger.recordStep>[1]): void {
    AgentAuditLogger.recordStep(cwd, trace);
  }

  private static async resolveDecision(
    complete: LLMCompletionFn,
    orchestratorModel: string,
    cwd: string,
    state: TurnPlanState,
    routing: DepartmentDelegationDecision,
    maxSteps: number,
    stepIndex: number,
    messageId: string | undefined,
    onActivity?: () => void
  ): Promise<SupervisorDecision | null> {
    const systemPrompt =
      PromptLoader.load('orchestrator.supervisor', {
        CATALOG: this.buildCatalog(cwd),
        MAX_STEPS: String(maxSteps),
        TRIAGE_HINT: this.buildTriageHint(routing),
        USER_GOAL: state.userGoal,
        COMPLETED_STEPS: state.formatForSupervisor(),
        TRUTHFULNESS_RULE: PromptLoader.load('core.truthfulness'),
      }) ||
      `Supervise specialists. JSON: delegate or finish. Catalog:\n${this.buildCatalog(cwd)}`;

    onActivity?.();
    const start = Date.now();

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await complete(
          [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content:
                stepIndex === 0
                  ? 'Decide the first action for this turn.'
                  : `Decide the next action after step ${stepIndex}.`,
            },
          ],
          false,
          {
            purpose: 'orchestrator_supervisor',
            agent: 'orchestrator',
            model: orchestratorModel,
            messageId,
            supervisorStep: stepIndex + 1,
            supervisorAttempt: attempt + 1,
          }
        );

        const decision = this.parseDecision((response.content || '').trim());
        if (decision) {
          this.audit(cwd, {
            step: 'orchestrator_supervisor',
            agent: 'orchestrator',
            messageId,
            supervisorStep: stepIndex + 1,
            decision: decision.action,
            purpose: `Supervisor LLM decision: ${decision.action} (step ${stepIndex + 1}/${maxSteps})`,
            latencyMs: Date.now() - start,
            responsePreview: (decision.reasoning || JSON.stringify(decision)).slice(0, 200),
            metadata: {
              attempt: attempt + 1,
              maxSteps,
              completedWorkerSteps: state.steps.length,
            },
          });
          return decision;
        }
      } catch {
        // retry
      }
    }

    return null;
  }

  /**
   * Supervisor loop: delegate specialists until finish or max steps.
   * Single-step delegation is the degenerate case (maxSteps=1 or finish after first worker).
   */
  static async runDelegation(options: TurnSupervisorOptions): Promise<TurnSupervisorResult> {
    const maxSteps = this.resolveMaxSteps(options.maxSupervisorSteps);
    const state = new TurnPlanState(options.userGoal);
    const contextPlan = options.routing.contextPlan ?? DEFAULT_SYNTHESIS_CONTEXT_PLAN;
    const messageId = options.messageId;

    this.audit(options.cwd, {
      step: 'supervisor_turn_start',
      agent: 'orchestrator',
      messageId,
      purpose: `Supervisor turn started (max ${maxSteps} delegations)`,
      metadata: {
        departmentId: options.routing.departmentId,
        triageAgentId: options.routing.agentId,
        maxSteps,
      },
    });

    if (AgentRegistry.getAllAgents(options.cwd).length === 0) {
      this.audit(options.cwd, {
        step: 'supervisor_turn_summary',
        agent: 'orchestrator',
        messageId,
        purpose: 'Supervisor turn ended — no specialists registered',
        metadata: { outcome: 'no_agents', ...state.toAuditMetadata() },
      });
      return {
        handover: {
          userGoal: options.userGoal,
          technicalFindings: '(Nenhum agente especialista registrado no sistema)',
          guidanceForSender: 'Informe ao usuário que não há especialistas disponíveis no momento.',
          isFastPath: true,
          contextPlan,
        },
        toolsExecutedCount: 0,
        supervisorSteps: 0,
      };
    }

    let lastGuidance =
      'Synthesize all verified specialist findings clearly for the user.';
    let supervisorLlmSteps = 0;

    for (let step = 0; step < maxSteps; step++) {
      const decision =
        (await this.resolveDecision(
          options.complete,
          options.orchestratorModel,
          options.cwd,
          state,
          options.routing,
          maxSteps,
          step,
          messageId,
          options.onActivity
        )) ??
        (step === 0 && options.routing.agentId
          ? {
              action: 'delegate' as const,
              agentId: options.routing.agentId,
              task: options.routing.taskDescription || options.userGoal,
              reasoning: 'Supervisor parse fallback — using triage hint',
            }
          : step > 0
            ? { action: 'finish' as const, guidanceForSender: lastGuidance, reasoning: 'Supervisor parse fallback — finish' }
            : null);

      if (!decision) {
        break;
      }

      supervisorLlmSteps += 1;

      if (decision.action === 'finish') {
        lastGuidance = decision.guidanceForSender;
        this.audit(options.cwd, {
          step: 'supervisor_finish',
          agent: 'orchestrator',
          messageId,
          supervisorStep: step + 1,
          decision: 'finish',
          purpose: `Supervisor finished after ${state.steps.length} worker step(s)`,
          responsePreview: decision.guidanceForSender.slice(0, 200),
          metadata: { reasoning: decision.reasoning },
        });
        break;
      }

      const agent = this.resolveAgent(decision.agentId, options.routing.departmentId, options.cwd);
      if (!agent) {
        if (state.steps.length > 0) break;
        this.audit(options.cwd, {
          step: 'supervisor_turn_summary',
          agent: 'orchestrator',
          messageId,
          purpose: 'Supervisor turn ended — specialist not found',
          metadata: { outcome: 'agent_not_found', requestedAgentId: decision.agentId, ...state.toAuditMetadata() },
        });
        return {
          handover: {
            userGoal: options.userGoal,
            technicalFindings: '(Especialista não encontrado no catálogo)',
            guidanceForSender: 'Informe ao usuário que não há especialistas disponíveis no momento.',
            isFastPath: true,
            contextPlan,
          },
          toolsExecutedCount: 0,
          supervisorSteps: step,
        };
      }

      const policy = SupervisorPolicy.shouldForceFinish(
        state.capabilityRecords,
        agent.id,
        agent.capabilities?.[0],
      );
      if (policy.force) {
        lastGuidance =
          'Synthesize all verified specialist findings clearly for the user.';
        this.audit(options.cwd, {
          step: 'supervisor_finish',
          agent: 'orchestrator',
          messageId,
          supervisorStep: step + 1,
          decision: 'finish',
          purpose: `Supervisor auto-finish — ${policy.reason}`,
          metadata: { policyReason: policy.reason, requestedAgentId: agent.id },
        });
        break;
      }

      const task = this.buildDelegateTask(
        decision.task || options.routing.taskDescription || options.userGoal,
        state
      );

      this.audit(options.cwd, {
        step: 'supervisor_delegate',
        agent: agent.id,
        department: agent.departmentId,
        messageId,
        supervisorStep: step + 1,
        decision: 'delegate',
        purpose: `Supervisor delegated step ${step + 1} to ${agent.id}`,
        promptPreview: task.slice(0, 200),
        metadata: {
          requestedAgentId: decision.agentId,
          reasoning: decision.reasoning,
        },
      });

      this.audit(options.cwd, {
        step: 'agent_selection',
        agent: agent.id,
        department: agent.departmentId,
        messageId,
        supervisorStep: step + 1,
        purpose: `Worker selected: ${agent.id}`,
        promptPreview: task.slice(0, 100),
      });

      const workerProfile = ExecutionProfiles.resolve(agent.executionProfile);
      const workerResult = await WorkerAgentRunner.execute(agent, task, options.complete, options.cwd, {
        maxIterations: options.maxWorkerIterations ?? workerProfile.maxIterations,
        onActivity: options.onActivity,
        history: options.history,
        defaultModel: options.defaultModel,
        messageId,
        supervisorStep: step + 1,
      });

      state.appendStep({
        agentId: agent.id,
        agentName: agent.name,
        departmentId: agent.departmentId,
        taskDescription: task,
        workerResult,
      });

      this.audit(options.cwd, {
        step: 'orchestrator_evaluation',
        agent: 'orchestrator',
        messageId,
        supervisorStep: step + 1,
        purpose: `Worker step ${step + 1} complete — ${workerResult.findings.length} finding(s) from ${agent.id}`,
        responsePreview: workerResult.summary.slice(0, 200),
        metadata: {
          tools: workerResult.findings.map((f) => f.tool),
          findingsCount: workerResult.findings.length,
        },
      });

      if (step >= maxSteps - 1) {
        lastGuidance =
          'All supervisor delegations for this turn are complete. Synthesize the verified findings for the user.';
        break;
      }
    }

    const specialistNames = [...new Set(state.steps.map((s) => s.agentName))].join(', ') || 'nenhum';

    this.audit(options.cwd, {
      step: 'supervisor_turn_summary',
      agent: 'orchestrator',
      messageId,
      purpose: `Supervisor turn complete — ${state.steps.length} worker step(s), ${state.totalFindings} tool result(s)`,
      metadata: {
        outcome: 'complete',
        supervisorLlmSteps,
        specialistNames,
        lastGuidancePreview: lastGuidance.slice(0, 300),
        ...state.toAuditMetadata(),
      },
    });

    return {
      handover: {
        userGoal: options.userGoal,
        technicalFindings: state.buildTechnicalFindings(),
        workerSummary: state.buildWorkerSummaryLine(),
        guidanceForSender:
          lastGuidance ||
          `Os especialistas (${specialistNames}) concluíram as etapas. Sintetize as informações com clareza.`,
        isFastPath: false,
        contextPlan,
      },
      toolsExecutedCount: state.totalFindings,
      supervisorSteps: state.steps.length,
    };
  }
}
