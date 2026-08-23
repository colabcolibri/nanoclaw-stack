import type { ToolFinding } from '../agents/types.js';

/** Stable capability ids — routing and termination use these, not keywords. */
export type AgentCapability =
  | 'web.research'
  | 'metrics.tokens'
  | 'email.productivity'
  | 'commerce.store'
  | 'system.operations';

export type WorkerCompletionStatus =
  | 'sufficient'
  | 'partial'
  | 'blocked'
  | 'budget_exhausted';

export interface WorkerCompletion {
  status: WorkerCompletionStatus;
  /** Primary capability this worker was executing. */
  capability?: AgentCapability;
  /** Human-readable reason for supervisor / audit. */
  reason: string;
}

export type ToolDedupeKey = 'query' | 'url' | 'args_hash';

export interface ToolBudgetRule {
  maxCalls: number;
  dedupeKey?: ToolDedupeKey;
}

export interface WorkerExecutionProfile {
  id: string;
  maxIterations: number;
  toolBudgets: Record<string, ToolBudgetRule>;
  inferCompletion(input: CompletionInferenceInput): WorkerCompletion;
}

export interface CompletionInferenceInput {
  agentId: string;
  capability?: AgentCapability;
  findings: ToolFinding[];
  summary: string;
  iterationsRun: number;
  maxIterations: number;
  budgetExhausted: boolean;
}

export interface ToolBudgetRefusal {
  allowed: false;
  tool: string;
  reason: string;
  code: 'budget_exhausted' | 'duplicate_call';
}

export interface ToolBudgetAllow {
  allowed: true;
}

export type ToolBudgetDecision = ToolBudgetAllow | ToolBudgetRefusal;
