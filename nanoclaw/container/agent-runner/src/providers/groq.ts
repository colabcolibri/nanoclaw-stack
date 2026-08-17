import fs from 'fs';
import path from 'path';
import type { AgentProvider, ProviderInput, ProviderEvent, ProviderOptions } from './types.js';
import { registerProvider } from './provider-registry.js';
import { AGENT_TOOLS } from '../tools/index.js';
import { MemoryManager } from '../services/memory.js';
import { TokenLedger } from '../services/token-ledger.js';
import { TurnOrchestrator } from '../orchestrator/turn-orchestrator.js';

export class GroqProvider implements AgentProvider {
  name = 'groq';
  private model: string;
  private assistantName: string;

  constructor(options: ProviderOptions = {}) {
    this.model = options.model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    this.assistantName = options.assistantName || process.env.ASSISTANT_NAME || 'Íris';
  }

  run(input: ProviderInput): AsyncGenerator<ProviderEvent> {
    let aborted = false;
    const apiKey = process.env.GROQ_API_KEY;
    const baseURL = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
    const model = this.model;

    // Load group instructions
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

    const self = this;

    async function* executeTurn(): AsyncGenerator<ProviderEvent> {
      yield { type: 'activity' };

      if (!apiKey) {
        yield {
          type: 'result',
          text: 'Error: GROQ_API_KEY is not configured in NanoClaw .env',
          isError: true,
        };
        return;
      }

      try {
        const url = `${baseURL}/chat/completions`;

        // Direct HTTP Completion Function implementing standard OpenAI/Groq contract
        const completeFn = async (currentMessages: any[], enableTools: boolean) => {
          if (aborted) throw new Error('Query aborted');

          const payload: any = {
            model,
            messages: currentMessages,
            temperature: 0.6,
            stream: false,
          };

          if (enableTools && AGENT_TOOLS.length > 0) {
            payload.tools = AGENT_TOOLS;
            payload.tool_choice = 'auto';
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
            throw new Error(`Groq API Error (${res.status}): ${errText}`);
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

          return {
            content: msg.content,
            tool_calls: msg.tool_calls,
          };
        };

        // Assemble messages
        const messages: any[] = [];
        messages.push({
          role: 'system',
          content: systemParts.join('\n\n---\n\n'),
        });

        if (input.prompt) {
          messages.push({ role: 'user', content: input.prompt });
        }

        // Orchestrate turn loop
        const orchestrator = new TurnOrchestrator({
          maxIterations: 10,
          assistantName: self.assistantName,
        });

        const targetDest = input.chatJid || 'direct';
        const finalResponseText = await orchestrator.runTurn({
          messages,
          complete: completeFn,
          targetDest,
          cwd: input.cwd,
          onActivity: () => {},
        });

        yield {
          type: 'result',
          text: finalResponseText,
        };
      } catch (err: any) {
        yield {
          type: 'result',
          text: `Groq Error: ${err.message || String(err)}`,
          isError: true,
        };
      }
    }

    const generator = executeTurn();

    return {
      next: () => generator.next(),
      return: (val?: any) => {
        aborted = true;
        return generator.return(val);
      },
      throw: (err?: any) => {
        aborted = true;
        return generator.throw(err);
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  }
}

// Auto-register provider
registerProvider('groq', (options) => new GroqProvider(options));
