/**
 * Synchronous in-process turn execution for UI proxy channels (macOS app).
 * Runs on the Node motor with better-sqlite3 + native conversation backend.
 */
import fs from 'fs';
import path from 'path';

import { executeSlashCommand, parseSlashCommand } from '../commands/index.js';
import { DATA_DIR, GROUPS_DIR } from '../config.js';
import { getAgentGroupByFolder } from '../db/agent-groups.js';
import { getSession, updateSession } from '../db/sessions.js';
import {
  readConversationHistory,
  resolveActiveSession,
} from '../conversations/lifecycle.js';
import { createLlmSummarizeFn } from '../conversations/summarizer.js';
import { readLocalEnvFile } from './env-file.js';
import {
  initSessionFolder,
  writeOutboundDirect,
  writeSessionMessage,
} from '../session-manager.js';
import type { Session } from '../types.js';

const PROJECT_ROOT = process.cwd();
const CONTAINER_SRC = path.join(PROJECT_ROOT, 'container', 'agent-runner', 'src');
const REGISTRY_PATH = path.join(DATA_DIR, 'llm-models.json');

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
}

function resolveAgentGroupId(groupFolder: string): string {
  const group = getAgentGroupByFolder(groupFolder);
  if (!group?.id) {
    throw new Error(`Grupo de agente não encontrado para pasta: ${groupFolder}`);
  }
  return group.id;
}

async function getCompletionFunction(
  groupDir: string,
  userMsgId: string,
  roleModels?: { defaultModel: string; orchestratorModel?: string; senderModel?: string },
) {
  if (!roleModels?.defaultModel?.trim()) {
    throw new Error('model (worker) não configurado em container_configs');
  }

  const { ModelRegistry } = await import(path.join(CONTAINER_SRC, 'services', 'model-registry.ts'));
  if (!ModelRegistry.loadFromDisk(REGISTRY_PATH)) {
    throw new Error('llm-models.json não encontrado. Reinicie o NanoClaw.');
  }

  const envMap = readLocalEnvFile();
  const defaultModel = roleModels.defaultModel.trim();

  const completeFn = async (messages: any[], tools?: any[], options?: any) => {
    const explicitModel = options?.model as string | undefined;
    const targetModel = ModelRegistry.requireModelId(
      explicitModel ?? defaultModel,
      explicitModel ? 'model' : 'model',
      REGISTRY_PATH,
    );
    const invocation = ModelRegistry.requireInvocation(targetModel, REGISTRY_PATH);
    if (invocation.protocol !== 'openai-compatible') {
      throw new Error(`Modelo "${targetModel}" usa protocolo ${invocation.protocol} — não suportado neste gateway.`);
    }

    const apiKey = (envMap[invocation.keyEnvName] ?? process.env[invocation.keyEnvName])?.trim();
    if (!apiKey) {
      throw new Error(`API key ausente (${invocation.keyEnvName}). Configure no .env do NanoClaw.`);
    }

    const payload: any = {
      model: targetModel,
      messages: messages.map((m) => {
        const formatted: any = { role: m.role, content: m.content || '' };
        if (m.tool_calls) formatted.tool_calls = m.tool_calls;
        if (m.tool_call_id) formatted.tool_call_id = m.tool_call_id;
        return formatted;
      }),
    };
    if (tools && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }
    ModelRegistry.applyParamsToPayload(payload, targetModel, REGISTRY_PATH);

    const res = await fetch(invocation.completionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LLM API Error (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    const msg = data.choices?.[0]?.message || {};
    const usage = data.usage || {};

    try {
      const { TokenLedger } = await import(path.join(CONTAINER_SRC, 'services', 'token-ledger.ts'));
      const { buildLedgerPreview, resolvePurpose } = await import(
        path.join(CONTAINER_SRC, 'services', 'llm-call-purpose.ts')
      );
      const purpose = resolvePurpose({
        purpose: options?.purpose,
        hasToolCalls: Boolean(msg.tool_calls?.length),
      });
      TokenLedger.record(groupDir, targetModel, usage, {
        toolCallsCount: msg.tool_calls?.length || 0,
        preview: buildLedgerPreview(purpose, msg.content, msg.tool_calls),
        messageId: userMsgId,
        purpose,
      });
    } catch {
      /* telemetry optional */
    }

    return {
      content: msg.content,
      tool_calls: msg.tool_calls,
    };
  };

  return { completeFn };
}

export async function processSyncTurn(input: SyncTurnInput): Promise<SyncTurnResult> {
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

  const buildSummarizeFn = () =>
    createLlmSummarizeFn(async (messages) => {
      const { completeFn } = await getCompletionFunction(groupDir, `summarize-${Date.now()}`, {
        defaultModel: 'deepseek-chat',
      });
      const result = await completeFn(
        messages.map((m) => ({ role: m.role, content: m.text })),
        undefined,
        { purpose: 'conversation_summarize' },
      );
      return { content: result.content ?? '' };
    });

  const conversationMode = input.conversationMode ?? (input.resetSession ? 'new' : undefined);
  if (conversationMode) {
    await executeSlashCommand(conversationMode, callerContext, delivery, {
      summarizeWithLlm: conversationMode === 'new-resume' ? buildSummarizeFn() : undefined,
    });
  }

  const parsedSlash = parseSlashCommand(input.prompt);
  if (parsedSlash) {
    const cmdResult = await executeSlashCommand(parsedSlash.id, callerContext, delivery, {
      summarizeWithLlm: parsedSlash.id === 'new-resume' ? buildSummarizeFn() : undefined,
    });
    return {
      reply: cmdResult.reply,
      timestamp: new Date().toISOString(),
      toolsExecutedCount: 0,
    };
  }

  const session = pinnedSession
    ? pinnedSession.status !== 'active'
      ? (() => {
          throw new Error('Esta conversa está arquivada. Inicie uma nova conversa para continuar.');
        })()
      : pinnedSession
    : resolveActiveSession(callerContext).session;
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

  const soulFile = path.join(groupDir, 'instructions.prepend.md');
  let soulContent =
    'Você é o Barão, um assistente de IA prestativo, perspicaz e altamente resolutivo.';
  if (fs.existsSync(soulFile)) {
    soulContent = fs.readFileSync(soulFile, 'utf-8').trim();
  }

  let orchestratorModel: string | undefined;
  let senderModel: string | undefined;
  let defaultModel: string | undefined;
  const containerJsonPath = path.join(groupDir, 'container.json');
  if (fs.existsSync(containerJsonPath)) {
    try {
      const containerCfg = JSON.parse(fs.readFileSync(containerJsonPath, 'utf-8'));
      orchestratorModel = containerCfg.orchestratorModel;
      senderModel = containerCfg.senderModel;
      defaultModel = containerCfg.model;
    } catch {
      /* ignore */
    }
  }

  const { MemoryManager } = await import(path.join(CONTAINER_SRC, 'services', 'memory.ts'));
  const coreMemory = MemoryManager.loadCoreMemory(groupDir);

  const technicalDirectives = [
    `## Personalização de Canal (${input.channel.toUpperCase()}):\nVocê está interagindo diretamente com o Sérgio Luciano através do canal oficial ${input.channel}. Seja objetivo, resolutivo e mantenha um tom de parceria executiva inteligente.`,
    'Você possui ferramentas nativas conectadas para Notion, Google Calendar, Gmail, Yampi Store, Pesquisa Web e Memória. Sempre execute a ferramenta apropriada quando solicitado.',
  ].join('\n\n');

  const { completeFn } = await getCompletionFunction(groupDir, userMsgId, {
    defaultModel: defaultModel || 'deepseek-chat',
    orchestratorModel,
    senderModel,
  });

  const { TurnOrchestrator } = await import(path.join(CONTAINER_SRC, 'orchestrator', 'turn-orchestrator.ts'));

  const turnResult = await TurnOrchestrator.runTurn(completeFn, {
    prompt: input.prompt,
    cwd: groupDir,
    chatJid: threadId,
    history,
    systemInstructions: technicalDirectives,
    personaInstructions: soulContent,
    coreMemory,
    historyLimit: 30,
    orchestratorModel,
    senderModel,
    defaultModel: defaultModel || 'deepseek-chat',
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
  };
}

export async function resetSyncSession(
  channel: SyncChannel,
  groupFolder: string,
  userId = 'default',
  mode: 'new' | 'new-resume' = 'new',
): Promise<string> {
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

  const buildSummarizeFn = () =>
    createLlmSummarizeFn(async (messages) => {
      const { completeFn } = await getCompletionFunction(groupDir, `summarize-${Date.now()}`, {
        defaultModel: 'deepseek-chat',
      });
      const result = await completeFn(
        messages.map((m) => ({ role: m.role, content: m.text })),
        undefined,
        { purpose: 'conversation_summarize' },
      );
      return { content: result.content ?? '' };
    });

  const result = await executeSlashCommand(mode, callerContext, delivery, {
    summarizeWithLlm: mode === 'new-resume' ? buildSummarizeFn() : undefined,
  });
  return result.reply;
}
