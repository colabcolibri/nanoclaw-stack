import type { Session } from '../types.js';
import type {
  CallerContext,
  ConversationMessage,
  DeliveryAddress,
  SummarizeMessagesFn,
} from './types.js';

/**
 * Pluggable persistence layer for conversation lifecycle + slash-command acks.
 * Node host uses better-sqlite3; UI gateway (Bun) injects a bun:sqlite backend.
 */
export interface ConversationBackend {
  resolveActiveSession(ctx: CallerContext): { session: Session; created: boolean };
  archiveSession(session: Session): void;
  forgetSoft(agentGroupId: string, sessionId: string): void;
  createConversationSession(ctx: CallerContext, opts?: { conversationId?: string }): Session;
  startNewConversation(
    ctx: CallerContext,
    current: Session,
    opts?: { handoffText?: string },
  ): Session;
  startNewConversationWithResume(
    ctx: CallerContext,
    current: Session,
    summarizeWithLlm: SummarizeMessagesFn,
  ): Promise<{ session: Session; summary: string }>;
  readConversationHistory(agentGroupId: string, sessionId: string, limit?: number): ConversationMessage[];
  initSessionFolder(agentGroupId: string, sessionId: string): void;
  inboundDbPath(agentGroupId: string, sessionId: string): string;
  outboundDbPath(agentGroupId: string, sessionId: string): string;
  writeCommandAck(
    agentGroupId: string,
    sessionId: string,
    delivery: DeliveryAddress,
    text: string,
  ): void;
}
