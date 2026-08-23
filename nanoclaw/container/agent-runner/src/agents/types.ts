import type { ToolDefinition } from '../tools/types.js';
import type { LLMCompletionFn, LLMResponse } from '../orchestrator/types.js';
import type { ContextPlan } from '../services/context-pack.js';
import type { AgentCapability, WorkerCompletion } from '../execution/types.js';

export interface Department {
  id: string;
  name: string;
  description: string;
  agentIds: string[];
}

export interface SpecialistAgent {
  id: string;
  name: string;
  departmentId: string;
  role: string;
  description: string;
  systemPrompt: string;
  agentSkills: string[]; // Specific tool/skill names exclusive to this agent
  allowGlobalSkills?: boolean; // If true, agent can also use global utility skills (default: true)
  model?: string;
  /** Declarative worker loop profile (see execution/profiles.ts). */
  executionProfile?: string;
  /** Stable capability ids for routing and supervisor termination. */
  capabilities?: AgentCapability[];
}

export interface FastPathDecision {
  type: 'fast_path';
  reasoning: string;
  instructionsForSender: string;
  contextPlan?: ContextPlan;
}

export interface DepartmentDelegationDecision {
  type: 'department_delegation';
  reasoning: string;
  departmentId: string;
  agentId?: string;
  taskDescription: string;
  contextPlan?: ContextPlan;
}

export type RoutingDecision = FastPathDecision | DepartmentDelegationDecision;

export interface ToolFinding {
  tool: string;
  args: Record<string, any>;
  result: string;
  timestamp: string;
}

export interface WorkerResult {
  agentId: string;
  status: 'success' | 'partial' | 'error';
  findings: ToolFinding[];
  summary: string;
  rawFindingsReport: string;
  iterations: number;
  /** Structured completion contract for supervisor termination (code, not prompt). */
  completion: WorkerCompletion;
}

export interface HandoverPackage {
  userGoal: string;
  technicalFindings: string;
  guidanceForSender: string;
  workerSummary?: string;
  isFastPath?: boolean;
  contextPlan?: ContextPlan;
}

export interface AgentAuditTrace {
  step:
    | 'orchestrator_triage'
    | 'orchestrator_supervisor'
    | 'supervisor_turn_start'
    | 'supervisor_delegate'
    | 'supervisor_finish'
    | 'supervisor_turn_summary'
    | 'department_routing'
    | 'agent_selection'
    | 'worker_execution'
    | 'orchestrator_evaluation'
    | 'sender_synthesis'
    | 'semantic_memo';
  agent?: string;
  department?: string;
  purpose: string;
  latencyMs: number;
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  promptPreview?: string;
  responsePreview?: string;
  timestamp: string;
  /** ID da mensagem inbound que disparou o turn (correlação UI / ledger). */
  messageId?: string;
  /** Índice 1-based do passo do supervisor neste turn. */
  supervisorStep?: number;
  /** Decisão do supervisor neste passo. */
  decision?: 'delegate' | 'finish';
  /** Payload estruturado para replay / auditoria (steps, findings, etc.). */
  metadata?: Record<string, unknown>;
}

export interface MultiAgentTurnOptions {
  prompt: string;
  cwd: string;
  chatJid?: string;
  /** Mensagem inbound principal (correlação ledger + auditoria). */
  messageId?: string;
  /** IDs das mensagens inbound deste turn (para gravar memo semântico no SQLite). */
  inboundMessageIds?: string[];
  history: Array<{ role: string; memo?: string; content?: string; [key: string]: any }>;
  personaInstructions?: string;
  coreMemory?: string;
  systemInstructions?: string;
  historyLimit?: number;
  maxWorkerIterations?: number;
  maxSupervisorSteps?: number;
  orchestratorModel?: string;
  senderModel?: string;
  memoModel?: string;
  defaultModel?: string;
}
