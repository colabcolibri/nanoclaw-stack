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
  history: Array<{ role: string; content?: string; [key: string]: any }>;
  systemInstructions: string;
  personaInstructions?: string;
  coreMemory?: string;
  historyLimit?: number;
  maxIterations?: number;
}

export type LLMCallPurpose =
  | 'stage1_action'      // Etapa 1: Loop de Ação e Ferramentas
  | 'stage2_synthesis'   // Etapa 2: Síntese na Persona (Barão)
  | 'semantic_memo'      // Pós-Turno: Geração de Resumo Semântico
  | 'fast_path_direct'   // Conversação direta (sem ferramentas)
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

export interface OrchestratorResult {
  deliveredText: string;
  updatedHistory: any[];
  toolsExecutedCount: number;
  memo?: string;
}
