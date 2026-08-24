import type { Session } from '../types.js';
import { getConversationBackend } from './backend.js';
import type { CallerContext, SummarizeMessagesFn } from './types.js';

/** Archive a session and stop its container if running. */
export function archiveSession(session: Session): void {
  getConversationBackend().archiveSession(session);
}

/** Soft forget: clear LLM continuation and hide prior history from orchestrator. */
export function forgetSoft(agentGroupId: string, sessionId: string): void {
  getConversationBackend().forgetSoft(agentGroupId, sessionId);
}

/** Create a new active session for the same caller binding. */
export function createConversationSession(ctx: CallerContext, opts?: { conversationId?: string }): Session {
  return getConversationBackend().createConversationSession(ctx, opts);
}

/** Resolve the active session for a caller. */
export function resolveActiveSession(ctx: CallerContext): { session: Session; created: boolean } {
  return getConversationBackend().resolveActiveSession(ctx);
}

/** Read chronological conversation messages from session DBs. */
export function readConversationHistory(
  agentGroupId: string,
  sessionId: string,
  limit = 50,
): import('./types.js').ConversationMessage[] {
  return getConversationBackend().readConversationHistory(agentGroupId, sessionId, limit);
}

/** Hard forget: archive current session and start a new one. */
export function startNewConversation(ctx: CallerContext, current: Session, opts?: { handoffText?: string }): Session {
  return getConversationBackend().startNewConversation(ctx, current, opts);
}

/** /new-resume: archive, summarize prior session, bootstrap new session. */
export async function startNewConversationWithResume(
  ctx: CallerContext,
  current: Session,
  summarizeWithLlm: SummarizeMessagesFn,
): Promise<{ session: Session; summary: string }> {
  return getConversationBackend().startNewConversationWithResume(ctx, current, summarizeWithLlm);
}
