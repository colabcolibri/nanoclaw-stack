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
  historyLimit?: number;
  maxIterations?: number;
}

export interface LLMResponse {
  content?: string | null;
  tool_calls?: any[];
}

export type LLMCompletionFn = (messages: any[], enableTools: boolean) => Promise<LLMResponse>;

export interface OrchestratorResult {
  deliveredText: string;
  updatedHistory: any[];
  toolsExecutedCount: number;
}
