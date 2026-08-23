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
  threadId: string;
  userMsgId: string;
  history: Array<{ role: string; content: string }>;
  personaInstructions: string;
  systemInstructions: string;
  coreMemory: string;
  defaultModel: string;
  orchestratorModel?: string;
  senderModel?: string;
  registryPath: string;
  projectRoot: string;
}

export interface OrchestratorTurnResult {
  deliveredText: string;
  toolsExecutedCount: number;
}

export type SyncTurnRunnerOp = 'orchestrate';

export interface SyncTurnRunnerRequest {
  op: SyncTurnRunnerOp;
  orchestrate?: OrchestratorTurnRequest;
}
