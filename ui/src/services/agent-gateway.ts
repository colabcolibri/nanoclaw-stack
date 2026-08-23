import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "../config.js";
import { GroupManager } from "./groups.js";
import { ensureConversationDb, loadConversationModule, loadSessionManager } from "./conversation-bridge.js";

export interface ProcessTurnInput {
  prompt: string;
  channel: "macos" | "ios" | "telegram" | "whatsapp" | "web" | "api";
  groupFolder?: string;
  sessionId?: string;
  senderName?: string;
  userId?: string;
  /** @deprecated Use conversationMode instead */
  resetSession?: boolean;
  conversationMode?: "new" | "new-resume";
}

export interface ProcessTurnResult {
  reply: string;
  timestamp: string;
  toolsExecutedCount: number;
}

export interface HistoryMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
}

/**
 * UnifiedAgentGateway - Centralized Conversational Execution Bridge
 * Implements the Hexagonal Architecture (Ports & Adapters) pattern for NanoClaw.
 * 
 * Guarantees that ALL inbound channels (macOS, iOS, Telegram, WhatsApp, Web, API)
 * share 100% the exact same:
 * - Persona instructions & Soul loading (instructions.prepend.md)
 * - Persistent MemoryManager (core memory)
 * - LLM Provider resolution & dynamic fallback (DeepSeek, Groq, OpenAI)
 * - Two-stage TurnOrchestrator pipeline
 * - Dual SQLite Session Storage (inbound.db / outbound.db)
 * - TokenLedger telemetry tracking
 */
export class UnifiedAgentGateway {
  private static resolveAgentGroupId(groupFolder: string): string {
    const groups = GroupManager.list();
    const match = groups.find((g) => g.folder === groupFolder);
    if (!match?.id) {
      throw new Error(`Grupo de agente não encontrado para pasta: ${groupFolder}`);
    }
    return match.id;
  }

  /**
   * Resolves the active LLM completion function based on the centralized NanoClaw environment.
   * Supports per-role model routing via options.model (orchestrator, sender, worker).
   */
  private static async getCompletionFunction(groupDir: string, userMsgId: string, roleModels?: {
    defaultModel: string;
    orchestratorModel?: string;
    senderModel?: string;
  }) {
    if (!roleModels?.defaultModel?.trim()) {
      throw new Error('model (worker) não configurado em container_configs');
    }

    const { ModelRegistry } = await import(
      path.join(CONFIG.NANOCLAW_PATH, 'container', 'agent-runner', 'src', 'services', 'model-registry.ts')
    );
    const registryPath = path.join(CONFIG.DATA_PATH, 'llm-models.json');
    if (!ModelRegistry.loadFromDisk(registryPath)) {
      throw new Error('llm-models.json não encontrado. Reinicie o NanoClaw.');
    }

    const envMap = GroupManager.readNanoClawEnv();
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
        throw new Error(`API key ausente (${invocation.keyEnvName}). Configure em Credenciais LLM.`);
      }

      const payload: any = {
        model: targetModel,
        messages: messages.map((m) => {
          const formatted: any = { role: m.role, content: m.content || "" };
          if (m.tool_calls) formatted.tool_calls = m.tool_calls;
          if (m.tool_call_id) formatted.tool_call_id = m.tool_call_id;
          return formatted;
        }),
      };
      if (tools && tools.length > 0) {
        payload.tools = tools;
        payload.tool_choice = "auto";
      }
      ModelRegistry.applyParamsToPayload(payload, targetModel, registryPath);

      const res = await fetch(invocation.completionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        try {
          const errJson = JSON.parse(errText);
          const failedGen = errJson.error?.failed_generation;
          if (failedGen) {
            const parsedGen = JSON.parse(failedGen);
            const { ALL_TOOLS } = await import(
              path.join(CONFIG.NANOCLAW_PATH, 'container', 'agent-runner', 'src', 'tools', 'index.ts')
            );
            if (parsedGen && typeof parsedGen === 'object' && parsedGen.name) {
              const normalized = String(parsedGen.name).toLowerCase().replace(/-/g, '_');
              const targetName = normalized === 'web_research' ? 'web_search' : normalized;
              const targetTool = ALL_TOOLS[parsedGen.name] || ALL_TOOLS[normalized] || ALL_TOOLS[targetName];
              if (targetTool) {
                return {
                  content: '',
                  tool_calls: [
                    {
                      id: `call_${Date.now()}`,
                      type: 'function',
                      function: {
                        name: targetTool.definition.function.name,
                        arguments: typeof parsedGen.arguments === 'string' ? parsedGen.arguments : JSON.stringify(parsedGen.arguments || {}),
                      },
                    },
                  ],
                };
              }
            }
          }
        } catch {}

        throw new Error(`LLM API Error (${res.status}): ${errText}`);
      }

      const data = (await res.json()) as any;
      const msg = data.choices?.[0]?.message || {};
      const usage = data.usage || {};

      // Record token consumption into TokenLedger
      try {
        const { TokenLedger } = await import(
          path.join(CONFIG.NANOCLAW_PATH, 'container', 'agent-runner', 'src', 'services', 'token-ledger.ts')
        );
        const { buildLedgerPreview, resolvePurpose } = await import(
          path.join(CONFIG.NANOCLAW_PATH, 'container', 'agent-runner', 'src', 'services', 'llm-call-purpose.ts')
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
      } catch {}

      return {
        content: msg.content,
        tool_calls: msg.tool_calls,
      };
    };

    return { completeFn, defaultModel, orchestratorModel: roleModels?.orchestratorModel, senderModel: roleModels?.senderModel };
  }

  /**
   * Processes an incoming conversational turn from ANY client channel through the unified pipeline.
   */
  static async processTurn(input: ProcessTurnInput): Promise<ProcessTurnResult> {
    const { Database } = await import("bun:sqlite");
    const groupFolder = input.groupFolder ?? CONFIG.DEFAULT_GROUP_FOLDER;
    const agentGroupId = this.resolveAgentGroupId(groupFolder);
    const userId = input.userId?.trim() || "default";
    const threadId = `${input.channel}:${userId}`;
    const senderName =
      input.senderName ||
      (input.channel === "macos" ? "MacBook (Sérgio)" : input.channel === "ios" ? "iPhone (Sérgio)" : "Sérgio");

    await ensureConversationDb();
    const conversations = await loadConversationModule();
    const sessionManager = await loadSessionManager();
    const { resolveActiveSession, readConversationHistory, parseConversationCommand, executeConversationCommand, createLlmSummarizeFn } =
      conversations;
    const { initSessionFolder, inboundDbPath, outboundDbPath } = sessionManager;

    const callerContext = {
      agentGroupId,
      messagingGroupId: null as string | null,
      threadId,
      sessionMode: "per-thread" as const,
      channelType: input.channel,
      platformId: threadId,
      userId,
    };

    const delivery = {
      channelType: input.channel,
      platformId: threadId,
      threadId,
    };

    const buildSummarizeFn = () =>
      createLlmSummarizeFn(async (messages) => {
        const { completeFn } = await this.getCompletionFunction(
          path.join(CONFIG.GROUPS_PATH, groupFolder),
          `summarize-${Date.now()}`,
          { defaultModel: "deepseek-chat" },
        );
        return completeFn(messages, undefined, { purpose: "conversation_summarize" });
      });

    const conversationMode = input.conversationMode ?? (input.resetSession ? "new" : undefined);
    if (conversationMode) {
      await executeConversationCommand(conversationMode, callerContext, delivery, {
        summarizeWithLlm: conversationMode === "new-resume" ? buildSummarizeFn() : undefined,
      });
    }

    const slashCommand = parseConversationCommand(input.prompt);
    if (slashCommand) {
      const cmdResult = await executeConversationCommand(slashCommand, callerContext, delivery, {
        summarizeWithLlm: slashCommand === "new-resume" ? buildSummarizeFn() : undefined,
      });
      return {
        reply: cmdResult.reply,
        timestamp: new Date().toISOString(),
        toolsExecutedCount: 0,
      };
    }

    const { session } = resolveActiveSession(callerContext);
    const sessionId = session.id;

    initSessionFolder(agentGroupId, sessionId);
    const inDbPath = inboundDbPath(agentGroupId, sessionId);
    const outDbPath = outboundDbPath(agentGroupId, sessionId);

    const inDb = new Database(inDbPath);
    const outDb = new Database(outDbPath);

    // 1. Record incoming user message timestamp BEFORE execution starts
    const requestTimestamp = new Date().toISOString();
    const userMsgId = `msg-${input.channel}-in-${Date.now()}`;
    inDb.run(
      `INSERT INTO messages_in (id, timestamp, kind, channel_type, thread_id, content) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userMsgId,
        requestTimestamp,
        "chat",
        input.channel,
        threadId,
        JSON.stringify({ text: input.prompt, sender: senderName, channel: input.channel }),
      ]
    );

    const historyMessages = readConversationHistory(agentGroupId, sessionId, 30);
    const history = historyMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.text }));

    // 3. Load Persona Soul, Core Memory and role models from container.json
    const groupDir = path.join(CONFIG.GROUPS_PATH, groupFolder);
    const soulFile = path.join(groupDir, "instructions.prepend.md");
    let soulContent = "Você é o Barão, um assistente de IA prestativo, perspicaz e altamente resolutivo.";
    if (fs.existsSync(soulFile)) {
      soulContent = fs.readFileSync(soulFile, "utf-8").trim();
    }

    let orchestratorModel: string | undefined;
    let senderModel: string | undefined;
    let defaultModel: string | undefined;
    const containerJsonPath = path.join(groupDir, "container.json");
    if (fs.existsSync(containerJsonPath)) {
      try {
        const containerCfg = JSON.parse(fs.readFileSync(containerJsonPath, "utf-8"));
        orchestratorModel = containerCfg.orchestratorModel;
        senderModel = containerCfg.senderModel;
        defaultModel = containerCfg.model;
      } catch {}
    }

    const { MemoryManager } = await import(
      path.join(CONFIG.NANOCLAW_PATH, "container", "agent-runner", "src", "services", "memory.ts")
    );
    const coreMemory = MemoryManager.loadCoreMemory(groupDir);

    const technicalDirectives = [
      `## Personalização de Canal (${input.channel.toUpperCase()}):\nVocê está interagindo diretamente com o Sérgio Luciano através do canal oficial ${input.channel}. Seja objetivo, resolutivo e mantenha um tom de parceria executiva inteligente.`,
      `Você possui ferramentas nativas conectadas para Notion, Google Calendar, Gmail, Yampi Store, Pesquisa Web e Memória. Sempre execute a ferramenta apropriada quando solicitado.`,
    ].join("\n\n");

    // 4. Initialize LLM completion function with role-based model routing
    const { completeFn } = await this.getCompletionFunction(groupDir, userMsgId, {
      defaultModel: defaultModel || "deepseek-chat",
      orchestratorModel,
      senderModel,
    });

    // 5. Execute Turn via TurnOrchestrator
    const { TurnOrchestrator } = await import(
      path.join(CONFIG.NANOCLAW_PATH, "container", "agent-runner", "src", "orchestrator", "turn-orchestrator.ts")
    );

    const turnResult = await TurnOrchestrator.runTurn(completeFn, {
      prompt: input.prompt,
      cwd: groupDir,
      chatJid: threadId,
      history,
      systemInstructions: technicalDirectives,
      personaInstructions: soulContent,
      coreMemory: coreMemory,
      historyLimit: 30,
      orchestratorModel,
      senderModel,
      defaultModel: defaultModel || "deepseek-chat",
    });

    const cleanReply = turnResult.deliveredText
      .replace(/<message[^>]*>/gi, "")
      .replace(/<\/message>/gi, "")
      .trim();

    // 6. Record assistant outbound message
    const responseTimestamp = new Date().toISOString();
    const assistantMsgId = `msg-${input.channel}-out-${Date.now()}`;

    inDb.close();

    outDb.run(
      `INSERT INTO messages_out (id, in_reply_to, timestamp, kind, channel_type, thread_id, content) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        assistantMsgId,
        userMsgId,
        responseTimestamp,
        "chat",
        input.channel,
        threadId,
        `<message to="${threadId}">\n${cleanReply}\n</message>`,
      ]
    );
    outDb.close();

    // 7. Touch central session registry
    if (fs.existsSync(CONFIG.DB_PATH)) {
      const centralDb = new Database(CONFIG.DB_PATH);
      try {
        centralDb.run(
          `INSERT INTO sessions (id, agent_group_id, messaging_group_id, thread_id, conversation_id, status, container_status, created_at)
           VALUES (?, ?, NULL, ?, ?, 'active', 'stopped', ?)
           ON CONFLICT(id) DO UPDATE SET last_active = excluded.created_at`,
          [sessionId, agentGroupId, threadId, session.conversation_id ?? sessionId, responseTimestamp]
        );
      } catch {}
      centralDb.close();
    }

    return {
      reply: cleanReply,
      timestamp: responseTimestamp,
      toolsExecutedCount: turnResult.toolsExecutedCount,
    };
  }

  /**
   * Retrieves paginated, sorted message history for any channel session.
   */
  static async getHistory(channel: string, groupFolder: string, limit = 50, userId = "default"): Promise<HistoryMessage[]> {
    await ensureConversationDb();
    const conversations = await loadConversationModule();
    const agentGroupId = this.resolveAgentGroupId(groupFolder);
    const threadId = `${channel}:${userId}`;
    const { session } = conversations.resolveActiveSession({
      agentGroupId,
      messagingGroupId: null,
      threadId,
      sessionMode: "per-thread",
      channelType: channel,
      platformId: threadId,
      userId,
    });

    const messages = conversations.readConversationHistory(agentGroupId, session.id, limit);
    return messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m, i) => ({
        id: `${m.role}-${i}-${m.timestamp}`,
        role: m.role as "user" | "assistant",
        text: m.text,
        timestamp: m.timestamp,
      }));
  }

  /**
   * Starts a new conversation (/new) for any channel session.
   */
  static async resetSession(channel: string, groupFolder: string, userId = "default"): Promise<boolean> {
    await ensureConversationDb();
    const conversations = await loadConversationModule();
    const agentGroupId = this.resolveAgentGroupId(groupFolder);
    const threadId = `${channel}:${userId}`;
    await conversations.executeConversationCommand(
      "new",
      {
        agentGroupId,
        messagingGroupId: null,
        threadId,
        sessionMode: "per-thread",
        channelType: channel,
        platformId: threadId,
        userId,
      },
      { channelType: channel, platformId: threadId, threadId },
    );
    return true;
  }
}
