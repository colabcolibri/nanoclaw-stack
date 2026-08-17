import fs from 'fs';
import path from 'path';
import { AGENT_TOOLS, executeTool } from '../tools/index.js';
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

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
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
    this.assistantName = options.assistantName || 'Assistant';
    this.mcpServers = options.mcpServers || {};
  }

  registerMemorySessionHook(hook: MemorySessionHookRegistration): void {
    this.memorySessionHook = hook;
  }

  isSessionInvalid(_err: unknown): boolean {
    return false;
  }

  onExchangeComplete?(exchange: ProviderExchange): void {
    // Optional logging/exchange hook
  }

  query(input: QueryInput): AgentQuery {
    const apiKey = this.apiKey;
    const baseURL = this.baseURL.replace(/\/+$/, '');
    const model = (this.defaultModel || 'deepseek-v4-flash').replace(/^deepseek\//, '');
    let aborted = false;

    // Load or initialize conversation history from continuation
    let history: Message[] = [];
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

    // Prepare system instructions
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
          if (content && !systemParts.includes(content)) {
            systemParts.push(content);
          }
        }
      } catch {}
    }

    if (input.systemContext?.instructions) {
      systemParts.push(input.systemContext.instructions);
    }

    if (this.mcpServers && Object.keys(this.mcpServers).length > 0) {
      const activeTools = Object.keys(this.mcpServers).filter((k) => k !== "nanoclaw");
      if (activeTools.length > 0) {
        systemParts.push(
          `## Ferramentas e Integrações MCP Conectadas no Ambiente:\n` +
            activeTools.map((t) => `- **${t}**: Integração oficial Google ${t.toUpperCase()} configurada via MCP.`).join("\n") +
            `\nVocê possui essas integrações MCP conectadas para Google Calendar, Gmail e Drive.`
        );
      }
    }

    // Build message list
    const messages: Message[] = [
      { role: 'system', content: systemParts.join('\n\n') },
      ...history,
      { role: 'user', content: input.prompt },
    ];

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
        let currentMessages: any[] = [...messages];
        let finalContent = '';
        const maxToolIterations = 5;

        for (let iter = 0; iter < maxToolIterations; iter++) {
          if (aborted) break;
          yield { type: 'activity' };

          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: currentMessages,
              tools: AGENT_TOOLS,
              stream: false,
            }),
          });

          if (!res.ok) {
            const errText = await res.text();
            yield {
              type: 'result',
              text: `DeepSeek API Error (${res.status}): ${errText}`,
              isError: true,
            };
            return;
          }

          const data = (await res.json()) as any;
          const choice = data.choices?.[0];
          const assistantMsg = choice?.message;

          if (!assistantMsg) {
            break;
          }

          // If DeepSeek requested tool execution
          if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
            currentMessages.push(assistantMsg);

            for (const call of assistantMsg.tool_calls) {
              const fnName = call.function?.name;
              let fnArgs: any = {};
              try {
                fnArgs = JSON.parse(call.function?.arguments || '{}');
              } catch {}

              yield { type: 'activity' };
              const toolResult = await executeTool(fnName, fnArgs, input.cwd);

              currentMessages.push({
                role: 'tool',
                tool_call_id: call.id,
                name: fnName,
                content: toolResult,
              });
            }
            // Continue next iteration to let DeepSeek read tool output
            continue;
          }

        // If after tool execution finalContent is still empty, request a final summary
        if (!finalContent || !finalContent.trim()) {
          try {
            const summaryRes = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model,
                messages: [
                  ...currentMessages,
                  {
                    role: 'user',
                    content: 'Por favor, envie uma resposta final para o usuário informando com clareza o resultado das ações executadas acima.',
                  },
                ],
                stream: false,
              }),
            });
            if (summaryRes.ok) {
              const summaryData = (await summaryRes.json()) as any;
              finalContent = summaryData.choices?.[0]?.message?.content || '';
            }
          } catch {}
        }

        if (!finalContent || !finalContent.trim()) {
          finalContent = 'Ação executada com sucesso.';
        }

        // Determine target delivery channel/JID
        const fromMatch = input.prompt.match(/from="([^"]+)"/);
        const chatJidMatch = input.prompt.match(/chatJid="([^"]+)"/);
        const targetDest = fromMatch ? fromMatch[1] : (chatJidMatch ? chatJidMatch[1] : (input.chatJid || 'telegram'));

        // Ensure response is wrapped in <message to="..."> for NanoClaw delivery
        let deliveredContent = finalContent;
        if (!deliveredContent.includes('<message') && !deliveredContent.includes('<internal>')) {
          deliveredContent = `<message to="${targetDest}">\n${deliveredContent}\n</message>`;
        }

        // Update history (configurable via DEEPSEEK_HISTORY_LIMIT, default 50 messages)
        const historyLimit = Math.max(10, parseInt(process.env.DEEPSEEK_HISTORY_LIMIT || '50', 10));
        const updatedHistory: Message[] = [
          ...history,
          { role: 'user', content: input.prompt },
          { role: 'assistant', content: deliveredContent },
        ].slice(-historyLimit);

        yield {
          type: 'init',
          continuation: JSON.stringify(updatedHistory),
        };

        yield {
          type: 'result',
          text: deliveredContent,
          isError: false,
        };
      } catch (err: any) {
        yield {
          type: 'result',
          text: `DeepSeek Connection Error: ${err.message || String(err)}`,
          isError: true,
        };
      }
    }

    return {
      push: (_msg: string) => {
        // Handled via auto-wrap
      },
      end: () => {},
      abort: () => {
        aborted = true;
      },
      events: executeTurn(),
    };
  }
}

registerProvider('deepseek', (options) => new DeepSeekProvider(options));
