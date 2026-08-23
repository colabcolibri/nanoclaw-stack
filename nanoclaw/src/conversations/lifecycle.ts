import { killContainer, isContainerRunning } from '../container-runner.js';
import { createSession, updateSession } from '../db/sessions.js';
import { log } from '../log.js';
import {
  initSessionFolder,
  resolveSession,
  writeSessionMessage,
  writeSessionRouting,
} from '../session-manager.js';
import type { Session } from '../types.js';
import { readConversationHistory } from './history.js';
import { clearAllContinuations, setHistoryCutoff } from './session-state.js';
import { summarizeConversation } from './summarizer.js';
import type { CallerContext, SummarizeMessagesFn } from './types.js';
import { HANDOFF_PREFIX } from './types.js';

function generateSessionId(): string {
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Archive a session and stop its container if running. */
export function archiveSession(session: Session): void {
  const archivedAt = new Date().toISOString();
  if (isContainerRunning(session.id)) {
    killContainer(session.id, 'conversation-archived');
  }
  updateSession(session.id, { status: 'archived', archived_at: archivedAt, container_status: 'stopped' });
  log.info('Session archived', { sessionId: session.id, conversationId: session.conversation_id });
}

/** Soft forget: clear LLM continuation and hide prior history from orchestrator. */
export function forgetSoft(agentGroupId: string, sessionId: string): void {
  const now = new Date().toISOString();
  clearAllContinuations(agentGroupId, sessionId);
  setHistoryCutoff(agentGroupId, sessionId, now);
}

/** Create a new active session for the same caller binding. */
export function createConversationSession(
  ctx: CallerContext,
  opts?: { conversationId?: string },
): Session {
  const id = generateSessionId();
  const conversationId = opts?.conversationId ?? generateConversationId();
  const lookupThreadId = ctx.sessionMode === 'per-thread' ? ctx.threadId : ctx.sessionMode === 'shared' ? null : ctx.threadId;

  const session: Session = {
    id,
    agent_group_id: ctx.agentGroupId,
    messaging_group_id: ctx.messagingGroupId,
    thread_id: lookupThreadId,
    conversation_id: conversationId,
    agent_provider: null,
    status: 'active',
    container_status: 'stopped',
    last_active: null,
    archived_at: null,
    created_at: new Date().toISOString(),
  };

  createSession(session);
  initSessionFolder(ctx.agentGroupId, id);
  writeSessionRouting(ctx.agentGroupId, id);
  log.info('Conversation session created', {
    sessionId: id,
    conversationId,
    agentGroupId: ctx.agentGroupId,
    threadId: lookupThreadId,
  });
  return session;
}

/** Resolve the active session for a caller (wraps resolveSession). */
export function resolveActiveSession(ctx: CallerContext): { session: Session; created: boolean } {
  return resolveSession(ctx.agentGroupId, ctx.messagingGroupId, ctx.threadId, ctx.sessionMode);
}

/** Hard forget: archive current session and start a new one. */
export function startNewConversation(
  ctx: CallerContext,
  current: Session,
  opts?: { handoffText?: string },
): Session {
  archiveSession(current);
  const next = createConversationSession(ctx);
  if (opts?.handoffText) {
    writeSessionMessage(ctx.agentGroupId, next.id, {
      id: `handoff-${Date.now()}`,
      kind: 'chat',
      timestamp: new Date().toISOString(),
      platformId: ctx.platformId,
      channelType: ctx.channelType,
      threadId: ctx.threadId,
      content: JSON.stringify({
        text: `${HANDOFF_PREFIX}\n${opts.handoffText}`,
        sender: 'system',
        conversation_handoff: true,
      }),
      trigger: 0,
    });
  }
  return next;
}

/** /new-resume: archive, summarize prior session, bootstrap new session. */
export async function startNewConversationWithResume(
  ctx: CallerContext,
  current: Session,
  summarizeWithLlm?: SummarizeMessagesFn,
): Promise<{ session: Session; summary: string }> {
  const history = readConversationHistory(ctx.agentGroupId, current.id, 50);
  const summary = await summarizeConversation(history, summarizeWithLlm);
  const session = startNewConversation(ctx, current, { handoffText: summary });
  return { session, summary };
}
