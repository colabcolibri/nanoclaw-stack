export type SyncChannel = 'macos' | 'ios' | 'telegram' | 'whatsapp' | 'web' | 'api';

export interface SyncTurnInput {
  prompt: string;
  channel: SyncChannel;
  groupFolder: string;
  sessionId?: string;
  senderName?: string;
  userId?: string;
  resetSession?: boolean;
  conversationMode?: 'new' | 'new-resume';
}

export interface SyncTurnResult {
  reply: string;
  timestamp: string;
  toolsExecutedCount: number;
  sessionId: string;
}

export interface SyncResetResult {
  reply: string;
  sessionId: string;
}

/** Payload sent to the Bun orchestrator worker (no central DB access). */
export interface OrchestratorTurnRequest {
  prompt: string;
  groupDir: string;
  groupFolder: string;
  threadId: string;
  channel: SyncChannel;
  userMsgId: string;
  history: Array<{ role: string; content: string }>;
  registryPath: string;
  projectRoot: string;
}

export interface OrchestratorTurnResult {
  deliveredText: string;
  toolsExecutedCount: number;
}

export interface SummarizeRequest {
  messages: Array<{ role: string; text: string }>;
  groupDir: string;
  defaultModel: string;
  registryPath: string;
  projectRoot: string;
}

export type SyncTurnRunnerOp = 'orchestrate' | 'summarize';

export interface SyncTurnRunnerRequest {
  op: SyncTurnRunnerOp;
  orchestrate?: OrchestratorTurnRequest;
  summarize?: SummarizeRequest;
}
