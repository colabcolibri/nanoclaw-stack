import { OrchestratorAgent } from '../agents/orchestrator-agent.js';
import { readContainerLocation } from '../container-location.js';
import type { LLMCompletionFn, TurnOptions, OrchestratorResult } from './types.js';
import { getTimezone, formatSchedulingTimezoneRules } from '../timezone.js';

export function getTemporalContext(cwd?: string): string {
  const now = new Date();
  const resolvedTz = getTimezone(cwd);
  const location = readContainerLocation(cwd);

  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: resolvedTz,
      dateStyle: 'full',
      timeStyle: 'medium',
    }).format(now);

    const locationLine = location.location ? `- User Location: ${location.location}\n` : '';
    const schedulingRules = formatSchedulingTimezoneRules(resolvedTz, now);
    return `## Temporal & Geographic Context\n${locationLine}- Current Local Date & Time: ${formatted} (${resolvedTz})\n- ISO Timestamp: ${now.toISOString()}\n${schedulingRules}`;
  } catch {
    const locationLine = location.location ? `- User Location: ${location.location}\n` : '';
    const schedulingRules = formatSchedulingTimezoneRules(resolvedTz, now);
    return `## Temporal & Geographic Context\n${locationLine}- Current Date & Time: ${now.toUTCString()}\n- ISO Timestamp: ${now.toISOString()}\n${schedulingRules}`;
  }
}

export class TurnOrchestrator {
  /**
   * Runs a complete multi-agent turn through the OrchestratorAgent architecture:
   * 1. Orchestrator Triage (Fast-Path bypass vs Department routing)
   * 2. Department & Specialist Worker Selection
   * 3. Worker Agent Execution with isolated tools & skills
   * 4. Orchestrator Quality Gate & Evaluation
   * 5. Sender Agent Synthesis (Soul, Tone, Formatting)
   */
  static async runTurn(
    complete: LLMCompletionFn,
    options: TurnOptions,
    onActivity?: () => void
  ): Promise<OrchestratorResult> {
    const timeContext = getTemporalContext(options.cwd);

    return OrchestratorAgent.runTurn(
      complete,
      {
        prompt: options.prompt,
        cwd: options.cwd,
        chatJid: options.chatJid,
        messageId: options.messageId ?? options.inboundMessageIds?.[0],
        inboundMessageIds: options.inboundMessageIds,
        history: options.history,
        personaInstructions: options.personaInstructions,
        coreMemory: options.coreMemory,
        systemInstructions: options.systemInstructions,
        historyLimit: options.historyLimit,
        maxWorkerIterations: options.maxIterations,
        maxSupervisorSteps: options.maxSupervisorSteps,
        orchestratorModel: options.orchestratorModel,
        senderModel: options.senderModel,
        memoModel: options.memoModel,
        defaultModel: options.defaultModel,
      },
      timeContext,
      onActivity
    );
  }
}
