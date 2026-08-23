/**
 * Bun-only orchestrator worker — LLM + tools via agent-runner.
 * Must NOT import host modules that use better-sqlite3 (central v2.db).
 */
import fs from 'fs';
import path from 'path';

import { readLocalEnvFile } from './env-file.js';
import type {
  OrchestratorTurnRequest,
  OrchestratorTurnResult,
  SummarizeRequest,
} from './sync-turn-types.js';

const LLM_SUMMARY_SYSTEM = `You summarize a conversation for handoff to a new session.
Output ONLY the summary (no preamble). Include: key facts, decisions, open tasks, preferences.
Maximum 2000 characters. Use the same language as the conversation.`;

async function getCompletionFunction(
  groupDir: string,
  userMsgId: string,
  registryPath: string,
  projectRoot: string,
  roleModels: { defaultModel: string; orchestratorModel?: string; senderModel?: string },
) {
  const containerSrc = path.join(projectRoot, 'container', 'agent-runner', 'src');

  if (!roleModels.defaultModel?.trim()) {
    throw new Error('model (worker) não configurado em container_configs');
  }

  const { ModelRegistry } = await import(path.join(containerSrc, 'services', 'model-registry.ts'));
  if (!ModelRegistry.loadFromDisk(registryPath)) {
    throw new Error('llm-models.json não encontrado. Reinicie o NanoClaw.');
  }

  const envMap = readLocalEnvFile();
  const defaultModel = roleModels.defaultModel.trim();

  const completeFn = async (messages: any[], tools?: any[], options?: any) => {
    const explicitModel = options?.model as string | undefined;
    const targetModel = ModelRegistry.requireModelId(
      explicitModel ?? defaultModel,
      explicitModel ? 'model' : 'model',
      registryPath,
    );
    const invocation = ModelRegistry.requireInvocation(targetModel, registryPath);
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
    ModelRegistry.applyParamsToPayload(payload, targetModel, registryPath);

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
      const { TokenLedger } = await import(path.join(containerSrc, 'services', 'token-ledger.ts'));
      const { buildLedgerPreview, resolvePurpose } = await import(
        path.join(containerSrc, 'services', 'llm-call-purpose.ts')
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

export async function runOrchestratorTurn(request: OrchestratorTurnRequest): Promise<OrchestratorTurnResult> {
  const containerSrc = path.join(request.projectRoot, 'container', 'agent-runner', 'src');
  const soulContent = readSoulContent(request.groupDir);
  const { orchestratorModel, senderModel, defaultModel } = readContainerModels(request.groupDir);
  const coreMemory = await loadCoreMemory(request.groupDir, request.projectRoot);

  const technicalDirectives = [
    `## Personalização de Canal (${request.channel.toUpperCase()}):\nVocê está interagindo diretamente com o Sérgio Luciano através do canal oficial ${request.channel}. Seja objetivo, resolutivo e mantenha um tom de parceria executiva inteligente.`,
    'Você possui ferramentas nativas conectadas para Notion, Google Calendar, Gmail, Yampi Store, Pesquisa Web e Memória. Sempre execute a ferramenta apropriada quando solicitado.',
  ].join('\n\n');

  const { completeFn } = await getCompletionFunction(
    request.groupDir,
    request.userMsgId,
    request.registryPath,
    request.projectRoot,
    {
      defaultModel: defaultModel || 'deepseek-chat',
      orchestratorModel,
      senderModel,
    },
  );

  const { TurnOrchestrator } = await import(path.join(containerSrc, 'orchestrator', 'turn-orchestrator.ts'));

  const turnResult = await TurnOrchestrator.runTurn(completeFn, {
    prompt: request.prompt,
    cwd: request.groupDir,
    chatJid: request.threadId,
    history: request.history,
    systemInstructions: technicalDirectives,
    personaInstructions: soulContent,
    coreMemory,
    historyLimit: 30,
    orchestratorModel,
    senderModel,
    defaultModel: defaultModel || 'deepseek-chat',
  });

  return {
    deliveredText: turnResult.deliveredText,
    toolsExecutedCount: turnResult.toolsExecutedCount,
  };
}

export async function runSummarize(request: SummarizeRequest): Promise<string> {
  const { completeFn } = await getCompletionFunction(
    request.groupDir,
    `summarize-${Date.now()}`,
    request.registryPath,
    request.projectRoot,
    { defaultModel: request.defaultModel },
  );

  const transcript = request.messages
    .map((m) => `${m.role}: ${m.text}`)
    .join('\n')
    .slice(0, 12000);

  const result = await completeFn(
    [
      { role: 'system', content: LLM_SUMMARY_SYSTEM },
      { role: 'user', content: transcript },
    ],
    undefined,
    { purpose: 'conversation_summarize' },
  );

  return result.content?.trim() ?? '';
}

export function loadCoreMemory(groupDir: string, projectRoot: string): Promise<string> {
  const containerSrc = path.join(projectRoot, 'container', 'agent-runner', 'src');
  return import(path.join(containerSrc, 'services', 'memory.ts')).then(({ MemoryManager }) =>
    MemoryManager.loadCoreMemory(groupDir),
  );
}

export function readSoulContent(groupDir: string): string {
  const soulFile = path.join(groupDir, 'instructions.prepend.md');
  if (fs.existsSync(soulFile)) {
    return fs.readFileSync(soulFile, 'utf-8').trim();
  }
  return 'Você é o Barão, um assistente de IA prestativo, perspicaz e altamente resolutivo.';
}

export function readContainerModels(groupDir: string): {
  orchestratorModel?: string;
  senderModel?: string;
  defaultModel?: string;
} {
  const containerJsonPath = path.join(groupDir, 'container.json');
  if (!fs.existsSync(containerJsonPath)) return {};
  try {
    const containerCfg = JSON.parse(fs.readFileSync(containerJsonPath, 'utf-8'));
    return {
      orchestratorModel: containerCfg.orchestratorModel,
      senderModel: containerCfg.senderModel,
      defaultModel: containerCfg.model,
    };
  } catch {
    return {};
  }
}
