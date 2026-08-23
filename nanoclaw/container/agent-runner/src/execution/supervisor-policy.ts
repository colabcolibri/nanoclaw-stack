import type { AgentCapability, WorkerCompletion } from './types.js';

export interface CapabilityRecord {
  agentId: string;
  capability?: AgentCapability;
  completion: WorkerCompletion;
}

/**
 * Code-level supervisor termination rules — not prompt hints.
 * Only blocks re-delegation for idempotent capabilities (web research, metrics)
 * where a second pass would waste tokens without new evidence.
 */
export class SupervisorPolicy {
  private static readonly IDEMPOTENT_CAPABILITIES = new Set<AgentCapability>([
    'web.research',
    'metrics.tokens',
  ]);

  static shouldForceFinish(
    records: CapabilityRecord[],
    _nextAgentId: string,
    nextCapability?: AgentCapability,
  ): { force: boolean; reason?: string } {
    if (!nextCapability || !this.IDEMPOTENT_CAPABILITIES.has(nextCapability)) {
      return { force: false };
    }

    const priorCapability = records.find(
      (r) => r.capability === nextCapability && r.completion.status === 'sufficient',
    );
    if (priorCapability) {
      return {
        force: true,
        reason: `Capability ${nextCapability} already satisfied by ${priorCapability.agentId}.`,
      };
    }

    return { force: false };
  }
}
