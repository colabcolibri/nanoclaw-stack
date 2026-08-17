import fs from 'fs';
import path from 'path';
import { AGENT_TOOLS } from '../tools/index.js';
import { TurnOrchestrator } from '../orchestrator/turn-orchestrator.js';
import { MemoryManager } from '../services/memory.js';
import { TokenLedger } from '../services/token-ledger.js';
import type { MemorySessionHookRegistration } from '../memory/session-hook.js';
import { registerProvider } from './provider-registry.js';
import type {
  AgentProvider,
  AgentQuery,
  ProviderEvent,
  ProviderOptions,
  QueryInput,
  ProviderExchange,
} from './types.js';

interface McpServerConfig {
  type?: string;
  command?: string;
  args?: string[];
  url?: string;
  [key: string]: any;
}

export class DeepSeekProvider implements AgentProvider {
  readonly supportsNativeSlashCommands = false;
  private memorySessionHook: MemorySessionHookRegistration | null = null;
  private apiKey: string;
  private baseURL: string;
  private defaultModel: string;
  private assistantName: string;
  private mcpServers: Record<string, McpServerConfig>;

  constructor(options: ProviderOptions) {
    this.apiKey =
      process.env.DEEPSEEK_API_KEY ||
      options.env?.DEEPSEEK_API_KEY ||
      '';
    this.baseURL =
      process.env.DEEPSEEK_BASE_URL ||
      options.env?.DEEPSEEK_BASE_URL ||
      'https://api.deepseek.com';
    this.defaultModel =
      process.env.DEEPSEEK_MODEL ||
      options.model ||
      'deepseek-v4-flash';
    this.assistantName = options.assistantName || 'Barão';
    this.mcpServers = options.mcpServers || {};
  }

  registerMemorySessionHook(hook: MemorySessionHookRegistration): void {
    this.memorySessionHook = hook;
  }

  isSessionInvalid(_err: unknown): boolean {
    return false;
  }

  onExchangeComplete?(exchange: ProviderExchange): void {
    // Optional telemetry/logging hook
  }

  query(input: QueryInput): AgentQuery {
    const apiKey = this.apiKey;
    const baseURL = this.baseURL.replace(/\/+$/, '');
    const model = (this.defaultModel || 'deepseek-v4-flash').replace(/^deepseek\//, '');
    let aborted = false;

    // Load or initialize conversation history from continuation
    let history: any[] = [];
    if (input.continuation) {
      try {
        const parsed = JSON.parse(input.continuation);
        if (Array.isArray(parsed)) {
          history = parsed;
        }
      } catch {
        history = [];
      }
    }

    // Build system instructions
    const systemParts: string[] = [
      `You are ${this.assistantName}, a helpful, intelligent personal AI assistant running on NanoClaw.`,
    ];

    const candidateFiles = [
      path.join(input.cwd, 'instructions.prepend.md'),
      '/workspace/group/instructions.prepend.md',
      path.join(input.cwd, 'CLAUDE.local.md'),
      '/workspace/group/CLAUDE.local.md',
    ];
    for (const f of candidateFiles) {
      try {
        if (fs.existsSync(f)) {
          const content = fs.readFileSync(f, 'utf-8').trim();
          if (content) {
            systemParts.push(content);
            break;
          }
        }
      } catch {}
    }

    if (input.systemContext?.instructions) {
      systemParts.push(input.systemContext.instructions);
    }

    // Inject Long-Term Semantic Memory (SRP: MemoryManager)
    const coreMemory = MemoryManager.loadCoreMemory(input.cwd);
    if (coreMemory) {
      systemParts.push(coreMemory);
    }

    const self = this;

    async function* executeTurn(): AsyncGenerator<ProviderEvent> {
      yield { type: 'activity' };

      if (!apiKey) {
        yield {
          type: 'result',
          text: 'Error: DEEPSEEK_API_KEY is not configured in NanoClaw .env',
          isError: true,
        };
        return;
      }

      try {
        const url = `${baseURL}/chat/completions`;

        // Direct HTTP Completion Function implementing standard contract
        const completeFn = async (currentMessages: any[], enableTools: boolean) => {
          if (aborted) throw new Error('Query aborted');

          const payload: any = {
            model,
            messages: currentMessages,
            stream: false,
          };

          if (enableTools && AGENT_TOOLS.length > 0) {
            payload.tools = AGENT_TOOLS;
          }

          const startTime = Date.now();
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
          const latencyMs = Date.now() - startTime;

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`DeepSeek API Error (${res.status}): ${errText}`);
          }

          const data = (await res.json()) as any;
          const msg = data.choices?.[0]?.message || {};
          const usage = data.usage || {};

          // Record real token consumption and exact Peak pricing
          try {
            TokenLedger.record(input.cwd, model, usage, {
              toolCallsCount: msg.tool_calls?.length || 0,
              latencyMs,
              preview: msg.content || (msg.tool_calls ? `Tool: ${msg.tool_calls[0]?.function?.name}` : ''),
            });
          } catch {}

          try {
            const logDir = path.join(input.cwd, 'logs');
            if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
            const logFile = path.join(logDir, 'deepseek_activity.log');
            fs.appendFileSync(
              logFile,
              `[${new Date().toISOString()}] ${JSON.stringify({
                event: 'deepseek_response',
                latencyMs,
                usage,
                content: msg.content,
                tool_calls: msg.tool_calls?.map((tc: any) => ({ name: tc.function?.name, args: tc.function?.arguments })),
              })}\n`,
              'utf-8'
            );
          } catch {}

          return {
            content: msg.content,
            tool_calls: msg.tool_calls,
          };
        };

        const historyLimit = Math.max(10, parseInt(process.env.DEEPSEEK_HISTORY_LIMIT || '50', 10));

        const turnResult = await TurnOrchestrator.runTurn(
          completeFn,
          {
            prompt: input.prompt,
            cwd: input.cwd,
            chatJid: input.chatJid,
            history,
            systemInstructions: systemParts.join('\n\n'),
            historyLimit,
          },
          () => {
            // Signal activity heartbeat on each step
          }
        );

        yield {
          type: 'init',
          continuation: JSON.stringify(turnResult.updatedHistory),
        };

        yield {
          type: 'result',
          text: turnResult.deliveredText,
          isError: false,
        };
      } catch (err: any) {
        yield {
          type: 'result',
          text: `DeepSeek Error: ${err.message || String(err)}`,
          isError: true,
        };
      }
    }

    return {
      push: (_msg: string) => {},
      end: () => {},
      abort: () => {
        aborted = true;
      },
      events: executeTurn(),
    };
  }
}

registerProvider('deepseek', (options) => new DeepSeekProvider(options));
