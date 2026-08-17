import fs from 'fs';
import path from 'path';
import { AGENT_TOOLS } from '../tools/index.js';
import { TurnOrchestrator } from '../orchestrator/turn-orchestrator.js';
import { MemoryManager } from '../services/memory.js';
import { TokenLedger } from '../services/token-ledger.js';
import type { MemorySessionHookRegistration } from '../memory/session-hook.js';
import type {
  AgentProvider,
  AgentQuery,
  ProviderEvent,
  ProviderOptions,
  QueryInput,
  ProviderExchange,
} from './types.js';

export interface BaseOpenAiConfig {
  providerName: string;
  defaultBaseUrl: string;
  defaultModel: string;
  envKeyName: string;
  envBaseUrlName?: string;
  envModelName?: string;
  logFileName?: string;
  customHeaders?: Record<string, string>;
}

export abstract class BaseOpenAiProvider implements AgentProvider {
  readonly supportsNativeSlashCommands = false;
  protected memorySessionHook: MemorySessionHookRegistration | null = null;
  protected apiKey: string;
  protected baseURL: string;
  protected defaultModel: string;
  protected assistantName: string;
  protected config: BaseOpenAiConfig;

  constructor(config: BaseOpenAiConfig, options: ProviderOptions) {
    this.config = config;
    this.apiKey =
      process.env[config.envKeyName] ||
      options.env?.[config.envKeyName] ||
      '';
    this.baseURL =
      (config.envBaseUrlName ? process.env[config.envBaseUrlName] || options.env?.[config.envBaseUrlName] : null) ||
      config.defaultBaseUrl;
    this.defaultModel =
      (config.envModelName ? process.env[config.envModelName] : null) ||
      options.model ||
      config.defaultModel;
    this.assistantName = options.assistantName || process.env.ASSISTANT_NAME || 'Íris';
  }

  registerMemorySessionHook(hook: MemorySessionHookRegistration): void {
    this.memorySessionHook = hook;
  }

  isSessionInvalid(_err: unknown): boolean {
    return false;
  }

  onExchangeComplete?(exchange: ProviderExchange): void {
    // Optional telemetry hook
  }

  query(input: QueryInput): AgentQuery {
    const apiKey = this.apiKey;
    const baseURL = this.baseURL.replace(/\/+$/, '');
    const model = this.defaultModel.trim();
    const providerName = this.config.providerName;
    const logFileName = this.config.logFileName || `${providerName}_activity.log`;
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
      `You are ${this.assistantName}, a helpful, fast, and intelligent personal AI assistant running on NanoClaw.`,
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

    // Inject Long-Term Semantic Memory
    const coreMemory = MemoryManager.loadCoreMemory(input.cwd);
    if (coreMemory) {
      systemParts.push(coreMemory);
    }

    const customHeaders = this.config.customHeaders || {};

    async function* executeTurn(): AsyncGenerator<ProviderEvent> {
      yield { type: 'activity' };

      if (!apiKey) {
        yield {
          type: 'result',
          text: `Error: ${providerName.toUpperCase()}_API_KEY is not configured in NanoClaw .env. Please configure your API key in settings.`,
          isError: true,
        };
        return;
      }

      try {
        const url = `${baseURL}/chat/completions`;

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
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            ...customHeaders,
          };

          const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          });
          const latencyMs = Date.now() - startTime;

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`${providerName} API Error (${res.status}): ${errText}`);
          }

          const data = (await res.json()) as any;
          const msg = data.choices?.[0]?.message || {};
          const usage = data.usage || {};

          // Record token consumption
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
            const logFile = path.join(logDir, logFileName);
            fs.appendFileSync(
              logFile,
              `[${new Date().toISOString()}] ${JSON.stringify({
                event: `${providerName}_response`,
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

        const historyLimit = Math.max(10, parseInt(process.env.CONVERSATION_HISTORY_LIMIT || '50', 10));

        const turnResult = await TurnOrchestrator.runTurn(
          completeFn,
          {
            prompt: input.prompt,
            cwd: input.cwd,
            chatJid: (input as any).chatJid,
            history,
            systemInstructions: systemParts.join('\n\n'),
            historyLimit,
          },
          () => {
            // Activity heartbeat
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
          text: `${providerName} Error: ${err.message || String(err)}`,
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
