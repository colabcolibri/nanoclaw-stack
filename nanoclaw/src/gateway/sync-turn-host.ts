/**
 * Node host for sync-turn — central DB, sessions, slash commands, message I/O.
 * Delegates LLM orchestration to Bun via IPC (no better-sqlite3 in worker).
 */
import path from 'path';

import { executeSlashCommand, parseSlashCommand } from '../commands/index.js';
import { DATA_DIR, GROUPS_DIR } from '../config.js';
import { ensureCentralDb } from '../db/ensure-central-db.js';
import { getAgentGroupByFolder } from '../db/agent-groups.js';
import { getSession, updateSession } from '../db/sessions.js';
import {
  readConversationHistory,
  resolveActiveSession,
} from '../conversations/lifecycle.js';
import type { SummarizeMessagesFn } from '../conversations/types.js';
import { summarizeConversation } from '../conversations/summarizer.js';
import {
  initSessionFolder,
  writeOutboundDirect,
  writeSessionMessage,
} from '../session-manager.js';
import type { Session } from '../types.js';
import { invokeOrchestratorTurn, invokeSummarize } from './sync-turn-bun-client.js';
import type {
  SyncChannel,
  SyncResetResult,
  SyncTurnInput,
  SyncTurnResult,
} from './sync-turn-types.js';

export type { SyncChannel, SyncResetResult, SyncTurnInput, SyncTurnResult } from './sync-turn-types.js';

const PROJECT_ROOT = process.cwd();
const REGISTRY_PATH = path.join(DATA_DIR, 'llm-models.json');

function resolveAgentGroupId(groupFolder: string): string {
  const group = getAgentGroupByFolder(groupFolder);
  if (!group?.id) {
    throw new Error(`Grupo de agente não encontrado para pasta: ${groupFolder}`);
  }
  return group.id;
}

function buildSummarizeFn(groupDir: string): SummarizeMessagesFn {
  return async (messages) => {
    try {
      const llmSummary = await invokeSummarize({
        messages: messages.map((m) => ({ role: m.role, text: m.text })),
        groupDir,
        defaultModel: 'deepseek-chat',
        registryPath: REGISTRY_PATH,
        projectRoot: PROJECT_ROOT,
      });
      if (llmSummary.trim()) return llmSummary.trim().slice(0, 2000);
    } catch {
      /* extractive fallback below */
    }
    return summarizeConversation(messages);
  };
}

export async function processSyncTurn(input: SyncTurnInput): Promise<SyncTurnResult> {
  ensureCentralDb();

  const groupFolder = input.groupFolder;
  const agentGroupId = resolveAgentGroupId(groupFolder);
  const userId = input.userId?.trim() || 'default';
  let threadId = `${input.channel}:${userId}`;
  const senderName =
    input.senderName ||
    (input.channel === 'macos' ? 'MacBook (Sérgio)' : input.channel === 'ios' ? 'iPhone (Sérgio)' : 'Sérgio');

  let pinnedSession: Session | null = null;
  if (input.sessionId?.trim()) {
    const row = getSession(input.sessionId.trim());
    if (!row) throw new Error('Sessão não encontrada.');
    if (row.agent_group_id !== agentGroupId) throw new Error('Sessão inválida para este grupo.');
    pinnedSession = row;
    if (row.thread_id) threadId = row.thread_id;
  }

  const callerContext = {
    agentGroupId,
    messagingGroupId: null as string | null,
    threadId,
    sessionMode: 'per-thread' as const,
    channelType: input.channel,
    platformId: threadId,
    userId,
  };

  const delivery = {
    channelType: input.channel,
    platformId: threadId,
    threadId,
  };

  const groupDir = path.join(GROUPS_DIR, groupFolder);
  const summarizeFn = buildSummarizeFn(groupDir);

  const conversationMode = input.conversationMode ?? (input.resetSession ? 'new' : undefined);
  let sessionAfterMode: Session | null = null;
  if (conversationMode) {
    const modeResult = await executeSlashCommand(conversationMode, callerContext, delivery, {
      summarizeWithLlm: conversationMode === 'new-resume' ? summarizeFn : undefined,
    });
    sessionAfterMode = modeResult.session;
    pinnedSession = null;
  }

  const parsedSlash = parseSlashCommand(input.prompt);
  if (parsedSlash) {
    const cmdResult = await executeSlashCommand(parsedSlash.id, callerContext, delivery, {
      summarizeWithLlm: parsedSlash.id === 'new-resume' ? summarizeFn : undefined,
    });
    return {
      reply: cmdResult.reply,
      timestamp: new Date().toISOString(),
      toolsExecutedCount: 0,
      sessionId: cmdResult.session.id,
    };
  }

  const session = sessionAfterMode
    ?? (pinnedSession
      ? pinnedSession.status !== 'active'
        ? (() => {
            throw new Error('Esta conversa está arquivada. Inicie uma nova conversa para continuar.');
          })()
        : pinnedSession
      : resolveActiveSession(callerContext).session);
  const sessionId = session.id;

  initSessionFolder(agentGroupId, sessionId);

  const requestTimestamp = new Date().toISOString();
  const userMsgId = `msg-${input.channel}-in-${Date.now()}`;
  writeSessionMessage(agentGroupId, sessionId, {
    id: userMsgId,
    kind: 'chat',
    timestamp: requestTimestamp,
    channelType: input.channel,
    threadId,
    content: JSON.stringify({ text: input.prompt, sender: senderName, channel: input.channel }),
    trigger: 0,
  });

  const historyMessages = readConversationHistory(agentGroupId, sessionId, 30);
  const history = historyMessages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.text }));

  const turnResult = await invokeOrchestratorTurn({
    prompt: input.prompt,
    groupDir,
    groupFolder,
    threadId,
    channel: input.channel,
    userMsgId,
    history,
    registryPath: REGISTRY_PATH,
    projectRoot: PROJECT_ROOT,
  });

  const cleanReply = turnResult.deliveredText
    .replace(/<message[^>]*>/gi, '')
    .replace(/<\/message>/gi, '')
    .trim();

  const responseTimestamp = new Date().toISOString();
  const assistantMsgId = `msg-${input.channel}-out-${Date.now()}`;

  writeOutboundDirect(agentGroupId, sessionId, {
    id: assistantMsgId,
    kind: 'chat',
    platformId: threadId,
    channelType: input.channel,
    threadId,
    content: `<message to="${threadId}">\n${cleanReply}\n</message>`,
  });

  updateSession(sessionId, { last_active: responseTimestamp });

  return {
    reply: cleanReply,
    timestamp: responseTimestamp,
    toolsExecutedCount: turnResult.toolsExecutedCount,
    sessionId,
  };
}

export async function resetSyncSession(
  channel: SyncChannel,
  groupFolder: string,
  userId = 'default',
  mode: 'new' | 'new-resume' = 'new',
): Promise<SyncResetResult> {
  ensureCentralDb();

  const agentGroupId = resolveAgentGroupId(groupFolder);
  const threadId = `${channel}:${userId}`;
  const callerContext = {
    agentGroupId,
    messagingGroupId: null as string | null,
    threadId,
    sessionMode: 'per-thread' as const,
    channelType: channel,
    platformId: threadId,
    userId,
  };
  const delivery = { channelType: channel, platformId: threadId, threadId };
  const groupDir = path.join(GROUPS_DIR, groupFolder);
  const summarizeFn = buildSummarizeFn(groupDir);

  const result = await executeSlashCommand(mode, callerContext, delivery, {
    summarizeWithLlm: mode === 'new-resume' ? summarizeFn : undefined,
  });
  return { reply: result.reply, sessionId: result.session.id };
}
