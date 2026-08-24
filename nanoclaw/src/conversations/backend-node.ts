import { killContainer, isContainerRunning } from '../container-runner.js';
import { createSession, findAllActiveConversationSessions, updateSession } from '../db/sessions.js';
import { log } from '../log.js';
import {
  initSessionFolder as initSessionFolderRaw,
  inboundDbPath as inboundDbPathRaw,
  outboundDbPath as outboundDbPathRaw,
  resolveSession,
  writeSessionMessage,
  writeSessionRouting,
  writeOutboundDirect,
} from '../session-manager.js';
import type { Session } from '../types.js';
import { readConversationHistory as readHistoryRaw } from './history.js';
import { clearAllContinuations, setHistoryCutoff } from './session-state.js';
import { summarizeConversation } from './summarizer.js';
import type { ConversationBackend } from './backend-types.js';
import type { CallerContext, SummarizeMessagesFn } from './types.js';
import { HANDOFF_PREFIX } from './types.js';

function generateSessionId(): string {
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createConversationSessionInternal(ctx: CallerContext, opts?: { conversationId?: string }): Session {
  const id = generateSessionId();
  const conversationId = opts?.conversationId ?? generateConversationId();
  const lookupThreadId =
    ctx.sessionMode === 'per-thread' ? ctx.threadId : ctx.sessionMode === 'shared' ? null : ctx.threadId;

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
  initSessionFolderRaw(ctx.agentGroupId, id);
  writeSessionRouting(ctx.agentGroupId, id);
  log.info('Conversation session created', {
    sessionId: id,
    conversationId,
    agentGroupId: ctx.agentGroupId,
    threadId: lookupThreadId,
  });
  return session;
}

export function createNodeConversationBackend(): ConversationBackend {
  return {
    resolveActiveSession(ctx: CallerContext) {
      return resolveSession(ctx.agentGroupId, ctx.messagingGroupId, ctx.threadId, ctx.sessionMode);
    },

    archiveSession(session: Session) {
      const archivedAt = new Date().toISOString();
      if (isContainerRunning(session.id)) {
        killContainer(session.id, 'conversation-archived');
      }
      updateSession(session.id, { status: 'archived', archived_at: archivedAt, container_status: 'stopped' });
      log.info('Session archived', { sessionId: session.id, conversationId: session.conversation_id });
    },

    forgetSoft(agentGroupId: string, sessionId: string) {
      const now = new Date().toISOString();
      clearAllContinuations(agentGroupId, sessionId);
      setHistoryCutoff(agentGroupId, sessionId, now);
      if (isContainerRunning(sessionId)) {
        killContainer(sessionId, 'conversation-cleared');
      }
      updateSession(sessionId, { container_status: 'stopped' });
      log.info('Conversation context cleared', { sessionId, agentGroupId });
    },

    createConversationSession(ctx: CallerContext, opts?: { conversationId?: string }) {
      return createConversationSessionInternal(ctx, opts);
    },

    startNewConversation(ctx: CallerContext, current: Session, opts?: { handoffText?: string }) {
      const lookupThreadId = ctx.sessionMode === 'per-thread' ? ctx.threadId : null;
      for (const stale of findAllActiveConversationSessions(
        ctx.agentGroupId,
        ctx.messagingGroupId,
        lookupThreadId,
        ctx.sessionMode,
      )) {
        this.archiveSession(stale);
      }
      const next = createConversationSessionInternal(ctx);
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
    },

    async startNewConversationWithResume(
      ctx: CallerContext,
      current: Session,
      summarizeWithLlm: SummarizeMessagesFn,
    ) {
      const history = readHistoryRaw(ctx.agentGroupId, current.id, 50);
      const summary = await summarizeConversation(history, summarizeWithLlm);
      const session = this.startNewConversation(ctx, current, { handoffText: summary });
      return { session, summary };
    },

    readConversationHistory(agentGroupId: string, sessionId: string, limit = 50) {
      return readHistoryRaw(agentGroupId, sessionId, limit);
    },

    initSessionFolder(agentGroupId: string, sessionId: string) {
      initSessionFolderRaw(agentGroupId, sessionId);
    },

    inboundDbPath(agentGroupId: string, sessionId: string) {
      return inboundDbPathRaw(agentGroupId, sessionId);
    },

    outboundDbPath(agentGroupId: string, sessionId: string) {
      return outboundDbPathRaw(agentGroupId, sessionId);
    },

    writeCommandAck(agentGroupId, sessionId, delivery, text) {
      writeOutboundDirect(agentGroupId, sessionId, {
        id: `cmd-ack-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: 'chat',
        platformId: delivery.platformId,
        channelType: delivery.channelType,
        threadId: delivery.threadId,
        content: JSON.stringify({
          text,
          sender: 'system',
          command_ack: true,
          ephemeral: false,
        }),
      });
    },
  };
}
