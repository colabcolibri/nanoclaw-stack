import fs from 'fs';
import path from 'path';
import { AGENT_TOOLS } from '../tools/index.js';
import { TurnOrchestrator } from '../orchestrator/turn-orchestrator.js';
import { MemoryManager } from '../services/memory.js';
import { TokenLedger } from '../services/token-ledger.js';
import { ModelRegistry } from '../services/model-registry.js';
import { PersonaLoader } from '../services/persona-loader.js';
import { buildLedgerPreview, resolvePurpose } from '../services/llm-call-purpose.js';
import { loadContainerRoleConfig } from '../services/container-role-config.js';
import { isToolPayloadFailure, rescueFailedGeneration } from './openai-error-rescue.js';
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
    const logFileName = this.config.logFileName ?? `${providerName}_activity.log`;
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

    const personaInstructions = PersonaLoader.loadSoul(input.cwd);

    const technicalDirectives = input.systemContext?.instructions || '';
    const coreMemory = MemoryManager.loadCoreMemory(input.cwd) || '';

    // Load role models from container.json (defaults do catálogo quando vazio)
    const roleConfig = loadContainerRoleConfig(
      input.cwd,
      (this as { catalogProviderId?: string }).catalogProviderId,
    );
    const { workerModel, orchestratorModel, senderModel, memoModel, roleInferenceOverrides } =
      roleConfig;

    const customHeaders = this.config.customHeaders || {};

    async function* executeTurn(): AsyncGenerator<ProviderEvent> {
      yield { type: 'activity' };

      if (!ModelRegistry.loadFromDisk(input.cwd)) {
        yield {
          type: 'result',
          text: 'Error: llm-models.json not found. Restart NanoClaw to materialize the catalog.',
          isError: true,
        };
        return;
      }

      try {
        const completeFn = async (currentMessages: any[], enableTools: boolean | any[], options?: any) => {
          if (aborted) throw new Error('Query aborted');

          const callModel = options?.model?.trim();
          if (!callModel) {
            throw new Error('model is required on every LLM call');
          }

          const targetModel = ModelRegistry.requireModelId(callModel, 'model', input.cwd);
          const invocation = ModelRegistry.requireInvocation(targetModel, input.cwd);
          if (invocation.protocol !== 'openai-compatible') {
            throw new Error(
              `Model "${targetModel}" uses protocol ${invocation.protocol}. Use the claude provider for Anthropic.`,
            );
          }

          const callApiKey = process.env[invocation.keyEnvName]?.trim();
          if (!callApiKey) {
            throw new Error(
              `Missing API key (${invocation.keyEnvName}) for model "${targetModel}" (provider ${invocation.providerId}). ` +
                `This group uses driver "${providerName}" — configure the key in LLM Credentials and use models from the same provider in container.json.`,
            );
          }

          const url = invocation.completionUrl;
          const payload: any = {
            model: targetModel,
            messages: currentMessages,
            stream: false,
          };
          ModelRegistry.applyParamsToPayload(payload, targetModel, {
            cwd: input.cwd,
            purpose: options?.purpose,
            roleOverrides: roleInferenceOverrides,
            callOverride: options?.inferenceOverride,
          });

          if (Array.isArray(enableTools)) {
            if (enableTools.length > 0) payload.tools = enableTools;
          } else if (enableTools && AGENT_TOOLS.length > 0) {
            payload.tools = AGENT_TOOLS;
          }

          const startTime = Date.now();
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${callApiKey}`,
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

            // Auto-rescue: providers OpenAI-compatible podem falhar no parse do
            // tool call (failed_generation). A recuperação vive em openai-error-rescue.
            try {
              const rescued = rescueFailedGeneration(errText);
              if (rescued) return rescued;

              // Fallback retry: se as tools causaram o 400, tenta sem tools
              if (payload.tools && isToolPayloadFailure(errText, res.status)) {
                const fallbackPayload = { ...payload };
                delete fallbackPayload.tools;
                const retryRes = await fetch(url, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify(fallbackPayload),
                });
                if (retryRes.ok) {
                  const retryData = (await retryRes.json()) as any;
                  const retryMsg = retryData.choices?.[0]?.message || {};
                  return {
                    content: retryMsg.content,
                    tool_calls: retryMsg.tool_calls,
                  };
                }
              }
            } catch {}

            throw new Error(`${providerName} API Error (${res.status}): ${errText}`);
          }

          const data = (await res.json()) as any;
          const msg = data.choices?.[0]?.message || {};
          const usage = data.usage || {};

          // Record token consumption
          try {
            const purpose = resolvePurpose({
              purpose: options?.purpose,
              hasToolCalls: Boolean(msg.tool_calls?.length),
            });

            TokenLedger.record(input.cwd, targetModel, usage, {
              toolCallsCount: msg.tool_calls?.length || 0,
              latencyMs,
              preview: buildLedgerPreview(purpose, msg.content, msg.tool_calls),
              messageId: options?.messageId ?? input.messageId,
              purpose,
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

        const resolvedWorker = ModelRegistry.requireModelId(workerModel ?? model, 'model', input.cwd);
        const resolvedOrchestrator = ModelRegistry.requireModelId(orchestratorModel, 'orchestratorModel', input.cwd);
        const resolvedSender = ModelRegistry.requireModelId(senderModel, 'senderModel', input.cwd);
        const resolvedMemo = ModelRegistry.requireModelId(memoModel, 'memoModel', input.cwd);

        const turnResult = await TurnOrchestrator.runTurn(
          completeFn,
          {
            prompt: input.prompt,
            cwd: input.cwd,
            chatJid: (input as any).chatJid,
            inboundMessageIds: input.inboundMessageIds,
            messageId: input.messageId ?? input.inboundMessageIds?.[0],
            history,
            systemInstructions: technicalDirectives,
            personaInstructions,
            coreMemory,
            historyLimit,
            orchestratorModel: resolvedOrchestrator,
            senderModel: resolvedSender,
            memoModel: resolvedMemo,
            defaultModel: resolvedWorker,
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
          outboundMemo: turnResult.assistantMemo,
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
