import type { ToolDefinition } from '../tools/types.js';
import type { LLMCompletionFn, LLMResponse } from '../orchestrator/types.js';
import type { ContextPlan } from '../services/context-pack.js';

export interface Department {
  id: string;
  name: string;
  description: string;
  keywords: string[];
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
}

export interface MultiAgentTurnOptions {
  prompt: string;
  cwd: string;
  chatJid?: string;
  /** IDs das mensagens inbound deste turn (para gravar memo semântico no SQLite). */
  inboundMessageIds?: string[];
  history: Array<{ role: string; memo?: string; content?: string; [key: string]: any }>;
  personaInstructions?: string;
  coreMemory?: string;
  systemInstructions?: string;
  historyLimit?: number;
  maxWorkerIterations?: number;
  orchestratorModel?: string;
  senderModel?: string;
  defaultModel?: string;
}
