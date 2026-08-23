/**
 * Node host for sync-turn — central DB, sessions, slash commands, message I/O.
 * Delegates LLM orchestration to Bun via IPC (no better-sqlite3 in worker).
 */
import path from 'path';

import { runSlashPipeline } from '../routing/slash-pipeline.js';
import { parseSlashCommand } from '../commands/index.js';
import { DATA_DIR, GROUPS_DIR } from '../config.js';
import { ensureCentralDb } from '../db/ensure-central-db.js';
import { getAgentGroupByFolder } from '../db/agent-groups.js';
import { getSession, updateSession } from '../db/sessions.js';
import {
  readConversationHistory,
  resolveActiveSession,
} from '../conversations/lifecycle.js';
import { loadGroupTurnContext } from './group-turn-context.js';
import { resolveGroupRoleModels } from '../container-config.js';
import {
  initSessionFolder,
  writeOutboundDirect,
  writeSessionMessage,
} from '../session-manager.js';
import type { Session } from '../types.js';
import { invokeOrchestratorTurn } from './sync-turn-bun-client.js';
import type {
  SyncChannel,
  SyncResetResult,
  SyncTurnInput,
  SyncTurnResult,
} from './sync-turn-types.js';

export type { SyncChannel, SyncResetResult, SyncTurnInput, SyncTurnResult } from './sync-turn-types.js';

const PROJECT_ROOT = process.cwd();
const REGISTRY_PATH = path.join(DATA_DIR, 'llm-models.json');

/** Remove wire-format delivery envelope; user-visible text only. */
function stripDeliveryEnvelope(raw: string): string {
  return raw
    .replace(/<message[^>]*>/gi, '')
    .replace(/<\/message>/gi, '')
    .trim();
}

function resolveAgentGroupId(groupFolder: string): string {
  const group = getAgentGroupByFolder(groupFolder);
  if (!group?.id) {
    throw new Error(`Grupo de agente não encontrado para pasta: ${groupFolder}`);
  }
  return group.id;
}

function resolveContainerModels(agentGroupId: string) {
  const resolved = resolveGroupRoleModels(agentGroupId);
  if (!resolved) {
    throw new Error('não foi possível resolver modelos do grupo — verifique provider e catálogo llm-models.json');
  }
  return {
    defaultModel: resolved.model,
    orchestratorModel: resolved.orchestratorModel,
    senderModel: resolved.senderModel,
    memoModel: resolved.memoModel,
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

  const conversationMode = input.conversationMode ?? (input.resetSession ? 'new' : undefined);
  const parsedSlashEarly = parseSlashCommand(input.prompt);

  const slashBase = {
    content: input.prompt,
    caller: callerContext,
    delivery,
    userId,
    agentGroupId,
    transport: 'sync' as const,
  };

  let sessionAfterMode: Session | null = null;
  let modeSlashReply: string | null = null;
  if (conversationMode) {
    const modeOutcome = await runSlashPipeline({
      ...slashBase,
      explicitCommandId: conversationMode,
    });
    if (modeOutcome.kind !== 'handled') {
      throw new Error(`Falha ao executar comando de conversa: ${conversationMode}`);
    }
    sessionAfterMode = modeOutcome.result.session;
    modeSlashReply = modeOutcome.result.reply;
    pinnedSession = null;
  }

  if (parsedSlashEarly) {
    if (conversationMode && parsedSlashEarly.id === conversationMode && modeSlashReply !== null) {
      return {
        reply: modeSlashReply,
        timestamp: new Date().toISOString(),
        toolsExecutedCount: 0,
        sessionId: sessionAfterMode!.id,
      };
    }
    if (parsedSlashEarly.id !== conversationMode) {
      const cmdOutcome = await runSlashPipeline({
        ...slashBase,
      });
      if (cmdOutcome.kind === 'handled') {
        return {
          reply: cmdOutcome.result.reply,
          timestamp: new Date().toISOString(),
          toolsExecutedCount: 0,
          sessionId: cmdOutcome.result.session.id,
        };
      }
    }
  }

  const models = resolveContainerModels(agentGroupId);
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

  const turnContext = loadGroupTurnContext(groupDir);
  const turnResult = await invokeOrchestratorTurn({
    prompt: input.prompt,
    groupDir,
    threadId,
    userMsgId,
    history,
    personaInstructions: turnContext.personaInstructions,
    systemInstructions: turnContext.systemInstructions,
    coreMemory: turnContext.coreMemory,
    defaultModel: models.defaultModel,
    orchestratorModel: models.orchestratorModel,
    senderModel: models.senderModel,
    memoModel: models.memoModel,
    registryPath: REGISTRY_PATH,
    projectRoot: PROJECT_ROOT,
  });

  const replyText = stripDeliveryEnvelope(turnResult.deliveredText);

  const responseTimestamp = new Date().toISOString();
  const assistantMsgId = `msg-${input.channel}-out-${Date.now()}`;

  writeOutboundDirect(agentGroupId, sessionId, {
    id: assistantMsgId,
    kind: 'chat',
    platformId: threadId,
    channelType: input.channel,
    threadId,
    content: JSON.stringify({ text: replyText }),
  });

  updateSession(sessionId, { last_active: responseTimestamp });

  return {
    reply: replyText,
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

  const outcome = await runSlashPipeline({
    content: `/${mode}`,
    caller: callerContext,
    delivery,
    userId,
    agentGroupId,
    transport: 'sync',
    explicitCommandId: mode,
  });
  if (outcome.kind !== 'handled') {
    throw new Error(`Falha ao reiniciar sessão (${mode}).`);
  }
  return { reply: outcome.result.reply, sessionId: outcome.result.session.id };
}
