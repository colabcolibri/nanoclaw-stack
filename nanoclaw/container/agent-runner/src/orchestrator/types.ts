import type { ToolDefinition } from '../tools/types.js';

export interface ExtractedToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface TurnOptions {
  prompt: string;
  cwd: string;
  chatJid?: string;
  messageId?: string;
  inboundMessageIds?: string[];
  history: Array<{ role: string; content?: string; [key: string]: any }>;
  systemInstructions: string;
  personaInstructions?: string;
  coreMemory?: string;
  historyLimit?: number;
  maxIterations?: number;
  maxSupervisorSteps?: number;
  orchestratorModel?: string;
  senderModel?: string;
  defaultModel?: string;
}

export type LLMCallPurpose =
  | 'stage1_action'      // Etapa 1: Loop de Ação e Ferramentas
  | 'stage2_synthesis'   // Etapa 2: Síntese na Persona (Barão)
  | 'semantic_memo'      // Pós-Turno: Geração de Resumo Semântico
  | 'fast_path_direct'   // Conversação direta (sem ferramentas)
  | 'orchestrator_triage' // Triagem e roteamento multi-agente
  | 'orchestrator_supervisor' // Loop supervisor: delegate | finish
  | 'skill_evaluation'   // Avaliação de Skills
  | 'system_diagnostics';// Diagnósticos / Testes

export interface LLMCallOptions {
  purpose: LLMCallPurpose;
  stage?: 1 | 2;
  iteration?: number;
  messageId?: string;
  channel?: string;
  [key: string]: any;
}

export interface LLMResponse {
  content?: string | null;
  tool_calls?: any[];
}

export type LLMCompletionFn = (
  messages: any[],
  enableTools: boolean | ToolDefinition[],
  options?: LLMCallOptions
) => Promise<LLMResponse>;

/** Entrada compacta no continuation — só memo, nunca texto integral. */
export interface ConversationMemoEntry {
  role: 'user' | 'assistant';
  memo: string;
  messageId?: string;
}

export interface OrchestratorResult {
  deliveredText: string;
  updatedHistory: ConversationMemoEntry[];
  toolsExecutedCount: number;
  userMemo: string;
  assistantMemo: string;
}
