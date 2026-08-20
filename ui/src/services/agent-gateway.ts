import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "../config.js";
import { GroupManager } from "./groups.js";

export interface ProcessTurnInput {
  prompt: string;
  channel: "macos" | "ios" | "telegram" | "whatsapp" | "web" | "api";
  groupFolder?: string;
  sessionId?: string;
  senderName?: string;
  resetSession?: boolean;
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
  private static getSessionDir(groupId: string, sessionId: string): string {
    const dir = path.join(CONFIG.DATA_PATH, "v2-sessions", groupId, sessionId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  /**
   * Resolves the active LLM completion function based on the centralized NanoClaw environment.
   */
  private static async getCompletionFunction(groupDir: string, userMsgId: string) {
    const envMap = GroupManager.readNanoClawEnv();
    const provider = (envMap["NANOCLAW_AGENT_PROVIDER"] || process.env.NANOCLAW_AGENT_PROVIDER || "deepseek").toLowerCase();

    let rawBase = envMap["DEEPSEEK_BASE_URL"] || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
    let apiKey = envMap["DEEPSEEK_API_KEY"] || process.env.DEEPSEEK_API_KEY || "";
    let modelName = (envMap["DEEPSEEK_MODEL"] || process.env.DEEPSEEK_MODEL || "deepseek-chat").replace(/^deepseek\//, "");

    if (provider === "groq" && (envMap["GROQ_API_KEY"] || process.env.GROQ_API_KEY)) {
      rawBase = envMap["GROQ_BASE_URL"] || "https://api.groq.com/openai/v1";
      apiKey = envMap["GROQ_API_KEY"] || process.env.GROQ_API_KEY || "";
      modelName = envMap["GROQ_MODEL"] || "llama-3.3-70b-versatile";
    } else if (!apiKey && (envMap["GROQ_API_KEY"] || process.env.GROQ_API_KEY)) {
      rawBase = envMap["GROQ_BASE_URL"] || "https://api.groq.com/openai/v1";
      apiKey = envMap["GROQ_API_KEY"] || process.env.GROQ_API_KEY || "";
      modelName = envMap["GROQ_MODEL"] || "llama-3.3-70b-versatile";
    }

    if (!apiKey) {
      throw new Error("Nenhuma chave de provedor LLM configurada no servidor (DEEPSEEK_API_KEY ou GROQ_API_KEY no .env).");
    }

    const cleanBase = rawBase.replace(/\/+$/, "");
    const completionEndpoint = cleanBase.endsWith("/chat/completions")
      ? cleanBase
      : cleanBase.endsWith("/v1")
      ? `${cleanBase}/chat/completions`
      : `${cleanBase}/chat/completions`;

    const completeFn = async (messages: any[], tools?: any[], options?: any) => {
      const payload: any = {
        model: modelName,
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

      const res = await fetch(completionEndpoint, {
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
        const purpose = options?.purpose || (msg.tool_calls?.length ? 'stage1_action' : 'stage2_synthesis');
        let previewPrefix = '';
        if (purpose === 'semantic_memo') {
          previewPrefix = 'Memo: ';
        } else if (purpose === 'stage1_action') {
          previewPrefix = msg.tool_calls?.length ? `Tool [${msg.tool_calls.map((t: any) => t.function?.name).join(', ')}]: ` : 'Ação: ';
        } else if (purpose === 'stage2_synthesis') {
          previewPrefix = 'Síntese: ';
        } else if (purpose === 'fast_path_direct') {
          previewPrefix = 'Conversa: ';
        }

        const previewText = msg.content ? `${previewPrefix}${msg.content}` : msg.tool_calls ? `Tool: ${msg.tool_calls[0]?.function?.name}` : '';

        TokenLedger.record(groupDir, modelName, usage, {
          toolCallsCount: msg.tool_calls?.length || 0,
          preview: previewText,
          messageId: userMsgId,
          purpose,
        });
      } catch {}

      return {
        content: msg.content,
        tool_calls: msg.tool_calls,
      };
    };

    return { completeFn, modelName };
  }

  /**
   * Processes an incoming conversational turn from ANY client channel through the unified pipeline.
   */
  static async processTurn(input: ProcessTurnInput): Promise<ProcessTurnResult> {
    const { Database } = await import("bun:sqlite");
    const groupFolder = input.groupFolder || "barao";
    const agentGroupId = "ag-4c9ad14f-4032-4305-8efc-0cd8b700042c";
    const sessionId = input.sessionId || `sess-${input.channel}-sergio`;
    const senderName = input.senderName || (input.channel === "macos" ? "MacBook (Sérgio)" : input.channel === "ios" ? "iPhone (Sérgio)" : "Sérgio");

    const sessionDir = this.getSessionDir(agentGroupId, sessionId);
    const inDbPath = path.join(sessionDir, "inbound.db");
    const outDbPath = path.join(sessionDir, "outbound.db");

    // Setup SQLite databases
    const inDb = new Database(inDbPath);
    inDb.run(`CREATE TABLE IF NOT EXISTS messages_in (
      id TEXT PRIMARY KEY, seq INTEGER, in_reply_to TEXT, timestamp TEXT NOT NULL,
      deliver_after TEXT, recurrence TEXT, kind TEXT NOT NULL, platform_id TEXT,
      channel_type TEXT, thread_id TEXT, content TEXT NOT NULL
    )`);

    const outDb = new Database(outDbPath);
    outDb.run(`CREATE TABLE IF NOT EXISTS messages_out (
      id TEXT PRIMARY KEY, seq INTEGER, in_reply_to TEXT, timestamp TEXT NOT NULL,
      deliver_after TEXT, recurrence TEXT, kind TEXT NOT NULL, platform_id TEXT,
      channel_type TEXT, thread_id TEXT, content TEXT NOT NULL
    )`);

    if (input.resetSession) {
      inDb.run(`DELETE FROM messages_in`);
      outDb.run(`DELETE FROM messages_out`);
    }

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
        `${input.channel}:sergio`,
        JSON.stringify({ text: input.prompt, sender: senderName, channel: input.channel }),
      ]
    );

    // 2. Read previous history for TurnOrchestrator context
    let history: Array<{ role: string; content?: string }> = [];
    try {
      const inRows = inDb.query(`SELECT timestamp, content FROM messages_in ORDER BY timestamp ASC`).all() as any[];
      const outRows = outDb.query(`SELECT timestamp, content FROM messages_out ORDER BY timestamp ASC`).all() as any[];

      const combined: Array<{ timestamp: string; role: "user" | "assistant"; text: string }> = [];

      for (const r of inRows) {
        let text = r.content || "";
        try {
          if (text.startsWith("{")) {
            const parsed = JSON.parse(text);
            text = parsed.text || parsed.content || text;
          }
        } catch {}
        combined.push({ timestamp: r.timestamp, role: "user", text });
      }

      for (const r of outRows) {
        let text = (r.content || "")
          .replace(/<message[^>]*>/gi, "")
          .replace(/<\/message>/gi, "")
          .trim();
        combined.push({ timestamp: r.timestamp, role: "assistant", text });
      }

      combined.sort((a, b) => {
        const tA = new Date(a.timestamp).getTime();
        const tB = new Date(b.timestamp).getTime();
        if (tA !== tB) return tA - tB;
        if (a.role === "user" && b.role === "assistant") return -1;
        if (a.role === "assistant" && b.role === "user") return 1;
        return 0;
      });
      history = combined.slice(-30).map((c) => ({ role: c.role, content: c.text }));
    } catch {}

    // 3. Load Persona Soul and Core Memory
    const groupDir = path.join(CONFIG.GROUPS_PATH, groupFolder);
    const soulFile = path.join(groupDir, "instructions.prepend.md");
    let soulContent = "Você é o Barão, um assistente de IA prestativo, perspicaz e altamente resolutivo.";
    if (fs.existsSync(soulFile)) {
      soulContent = fs.readFileSync(soulFile, "utf-8").trim();
    }

    const { MemoryManager } = await import(
      path.join(CONFIG.NANOCLAW_PATH, "container", "agent-runner", "src", "services", "memory.ts")
    );
    const coreMemory = MemoryManager.loadCoreMemory(groupDir);

    const technicalDirectives = [
      `## Personalização de Canal (${input.channel.toUpperCase()}):\nVocê está interagindo diretamente com o Sérgio Luciano através do canal oficial ${input.channel}. Seja objetivo, resolutivo e mantenha um tom de parceria executiva inteligente.`,
      `Você possui ferramentas nativas conectadas para Notion, Google Calendar, Gmail, Yampi Store, Pesquisa Web e Memória. Sempre execute a ferramenta apropriada quando solicitado.`,
    ].join("\n\n");

    // 4. Initialize LLM completion function
    const { completeFn } = await this.getCompletionFunction(groupDir, userMsgId);

    // 5. Execute Turn via TurnOrchestrator
    const { TurnOrchestrator } = await import(
      path.join(CONFIG.NANOCLAW_PATH, "container", "agent-runner", "src", "orchestrator", "turn-orchestrator.ts")
    );

    const turnResult = await TurnOrchestrator.runTurn(completeFn, {
      prompt: input.prompt,
      cwd: groupDir,
      chatJid: `${input.channel}:sergio`,
      history,
      systemInstructions: technicalDirectives,
      personaInstructions: soulContent,
      coreMemory: coreMemory,
      historyLimit: 30,
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
        `${input.channel}:sergio`,
        `<message to="${input.channel}:sergio">\n${cleanReply}\n</message>`,
      ]
    );
    outDb.close();

    // 7. Register in central v2.db
    if (fs.existsSync(CONFIG.DB_PATH)) {
      const centralDb = new Database(CONFIG.DB_PATH);
      try {
        centralDb.run(
          `INSERT INTO sessions (id, agent_group_id, created_at, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at`,
          [sessionId, agentGroupId, responseTimestamp, responseTimestamp]
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
  static async getHistory(channel: string, groupFolder = "barao", limit = 50): Promise<HistoryMessage[]> {
    const { Database } = await import("bun:sqlite");
    const agentGroupId = "ag-4c9ad14f-4032-4305-8efc-0cd8b700042c";
    const sessionId = `sess-${channel}-sergio`;
    const sessionDir = path.join(CONFIG.DATA_PATH, "v2-sessions", agentGroupId, sessionId);
    if (!fs.existsSync(sessionDir)) return [];

    const inDbPath = path.join(sessionDir, "inbound.db");
    const outDbPath = path.join(sessionDir, "outbound.db");

    const combined: HistoryMessage[] = [];

    if (fs.existsSync(inDbPath)) {
      try {
        const inDb = new Database(inDbPath, { readonly: true });
        const inRows = inDb.query(`SELECT id, timestamp, content FROM messages_in ORDER BY timestamp DESC LIMIT ?`).all(limit) as any[];
        inDb.close();
        for (const r of inRows) {
          let text = r.content || "";
          try {
            if (text.startsWith("{")) {
              const parsed = JSON.parse(text);
              text = parsed.text || parsed.content || text;
            }
          } catch {}
          combined.push({ id: r.id || `in-${r.timestamp}`, role: "user", text, timestamp: r.timestamp });
        }
      } catch {}
    }

    if (fs.existsSync(outDbPath)) {
      try {
        const outDb = new Database(outDbPath, { readonly: true });
        const outRows = outDb.query(`SELECT id, timestamp, content FROM messages_out ORDER BY timestamp DESC LIMIT ?`).all(limit) as any[];
        outDb.close();
        for (const r of outRows) {
          let text = (r.content || "")
            .replace(/<message[^>]*>/gi, "")
            .replace(/<\/message>/gi, "")
            .trim();
          combined.push({ id: r.id || `out-${r.timestamp}`, role: "assistant", text, timestamp: r.timestamp });
        }
      } catch {}
    }

    combined.sort((a, b) => {
      const tA = new Date(a.timestamp).getTime();
      const tB = new Date(b.timestamp).getTime();
      if (tA !== tB) return tA - tB;
      if (a.role === "user" && b.role === "assistant") return -1;
      if (a.role === "assistant" && b.role === "user") return 1;
      return 0;
    });

    return combined.slice(-limit);
  }

  /**
   * Resets history for any channel session.
   */
  static async resetSession(channel: string, groupFolder = "barao"): Promise<boolean> {
    const { Database } = await import("bun:sqlite");
    const agentGroupId = "ag-4c9ad14f-4032-4305-8efc-0cd8b700042c";
    const sessionId = `sess-${channel}-sergio`;
    const sessionDir = path.join(CONFIG.DATA_PATH, "v2-sessions", agentGroupId, sessionId);
    if (!fs.existsSync(sessionDir)) return true;

    const inDbPath = path.join(sessionDir, "inbound.db");
    const outDbPath = path.join(sessionDir, "outbound.db");

    if (fs.existsSync(inDbPath)) {
      try {
        const inDb = new Database(inDbPath);
        inDb.run(`DELETE FROM messages_in`);
        inDb.close();
      } catch {}
    }

    if (fs.existsSync(outDbPath)) {
      try {
        const outDb = new Database(outDbPath);
        outDb.run(`DELETE FROM messages_out`);
        outDb.close();
      } catch {}
    }

    return true;
  }
}
