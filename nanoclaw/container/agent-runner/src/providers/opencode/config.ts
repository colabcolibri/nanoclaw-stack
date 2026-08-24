import { mcpServersToOpenCodeConfig } from '../mcp-to-opencode.js';
import type { ProviderOptions } from '../types.js';
import { log } from './shared.js';

// The input modalities OpenCode's config schema accepts on a model entry
// (@opencode-ai/sdk types.gen.d.ts `modalities.input`). Anything outside this
// set makes OpenCode reject the whole config, so operator input is validated
// against it rather than passed through.
const MODEL_INPUT_MODALITIES = ['text', 'audio', 'image', 'video', 'pdf'] as const;

// A limit env var must be a bare positive integer (a token count) — units
// ("64k"), blank strings, zero, and negatives are rejected rather than
// coerced: Number() would turn blank into 0 (silently disables compaction,
// see below) and "64k" into NaN (the emitted config becomes unparseable
// JSON, and OpenCode fails to start). Invalid input is treated as unset.
function parseLimitEnv(varName: string, raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed) || Number(trimmed) <= 0) {
    log(`Ignoring invalid ${varName}: "${raw}"`);
    return undefined;
  }
  return Number(trimmed);
}

export function buildOpenCodeConfig(options: ProviderOptions): Record<string, unknown> {
  const provider = process.env.OPENCODE_PROVIDER || 'anthropic';
  const model = process.env.OPENCODE_MODEL;
  const smallModel = process.env.OPENCODE_SMALL_MODEL;
  const proxyUrl = process.env.ANTHROPIC_BASE_URL;

  const providerModelId = model ? model.replace(new RegExp(`^${provider}/`), '') : undefined;
  const providerSmallModelId = smallModel ? smallModel.replace(new RegExp(`^${provider}/`), '') : undefined;
  const modelsToRegister = [providerModelId, providerSmallModelId]
    .filter(Boolean)
    .filter((mid, i, a) => a.indexOf(mid as string) === i);

  // OpenCode auto-compacts a session once tokens >= limit.context - maxOutputTokens.
  // Undeclared custom models resolve limit.context to 0, which silently disables
  // compaction and kills long sessions against a fixed-window backend (e.g. vLLM).
  // Absent these env vars, behavior is unchanged (no `limit` key emitted).
  const contextLimitEnv = process.env.OPENCODE_MODEL_CONTEXT_LIMIT;
  const outputLimitEnv = process.env.OPENCODE_MODEL_OUTPUT_LIMIT;
  const contextLimit = parseLimitEnv('OPENCODE_MODEL_CONTEXT_LIMIT', contextLimitEnv);
  const outputLimit = parseLimitEnv('OPENCODE_MODEL_OUTPUT_LIMIT', outputLimitEnv);
  if (outputLimitEnv !== undefined && contextLimit === undefined) {
    log('Ignoring OPENCODE_MODEL_OUTPUT_LIMIT: no valid OPENCODE_MODEL_CONTEXT_LIMIT to pair it with');
  }
  const modelLimit =
    contextLimit !== undefined
      ? { context: contextLimit, ...(outputLimit !== undefined ? { output: outputLimit } : {}) }
      : undefined;

  // OpenCode drops every non-text file part whose modality the model does not
  // declare: provider/transform.ts:292 (v1.4.14) keeps a part only when
  // `model.capabilities.input[modality]` is true, and otherwise substitutes
  // `ERROR: Cannot read … (this model does not support <modality> input)`.
  // A registry-unknown custom model resolves each of those flags to false
  // (provider/provider.ts:1154-1158), so an image reaches the session store but
  // never the model — live-confirmed on a vLLM-hosted model, which answered
  // that it does not support image input while the prompt carried zero image
  // tokens. Declaring the modalities is the only thing that opens that gate;
  // `attachment` is a registry/UI flag rather than a pipeline gate, but it is
  // set alongside so the entry stays internally consistent.
  // Absent this env var, behavior is unchanged (no capability keys emitted).
  const modalityEnv = process.env.OPENCODE_MODEL_INPUT_MODALITIES;
  const requestedModalities = (modalityEnv ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .filter((entry, i, a) => a.indexOf(entry) === i)
    .filter((entry) => {
      if ((MODEL_INPUT_MODALITIES as readonly string[]).includes(entry)) return true;
      log(`Ignoring unknown OPENCODE_MODEL_INPUT_MODALITIES entry: ${entry}`);
      return false;
    })
    .filter((entry) => entry !== 'text');
  const modelModalities =
    requestedModalities.length > 0 ? { input: ['text', ...requestedModalities], output: ['text'] } : undefined;

  const providerOptions: Record<string, unknown> =
    provider === 'anthropic'
      ? {}
      : {
          [provider]: {
            // A custom base URL on the `openai` provider means a self-hosted
            // OpenAI-compatible endpoint (vLLM, llama.cpp, …). The stock openai
            // SDK package speaks the Responses API, whose multi-turn history
            // vLLM rejects (assistant items lack id/status) — pin the Chat
            // Completions transport. Scoped to `openai` only: other providers
            // (e.g. `openrouter`, set alongside ANTHROPIC_BASE_URL per the
            // documented OpenRouter config) ship their own native ai-sdk
            // package and must keep OpenCode's default transport resolution.
            ...(provider === 'openai' && proxyUrl ? { npm: '@ai-sdk/openai-compatible' } : {}),
            options: {
              apiKey:
                process.env.DEEPSEEK_API_KEY ||
                process.env.OPENROUTER_API_KEY ||
                process.env.GEMINI_API_KEY ||
                process.env.OPENAI_API_KEY ||
                process.env.ANTHROPIC_API_KEY ||
                'placeholder',
              ...(proxyUrl ? { baseURL: proxyUrl } : {}),
            },
            ...(modelsToRegister.length > 0
              ? {
                  models: Object.fromEntries(
                    modelsToRegister.map((mid) => {
                      // limit/modalities describe the MAIN model only — the env
                      // vars name no small-model equivalent. Spreading them onto
                      // a distinct OPENCODE_SMALL_MODEL entry would falsely
                      // declare its context window and media support as the
                      // main model's own. A small model that differs from the
                      // main one gets a bare entry instead, which resolves
                      // through OpenCode's own undeclared-model default.
                      const isMainModel = mid === providerModelId;
                      return [
                        mid,
                        {
                          id: mid,
                          name: mid,
                          tool_call: true,
                          ...(isMainModel && modelLimit ? { limit: modelLimit } : {}),
                          ...(isMainModel && modelModalities ? { attachment: true, modalities: modelModalities } : {}),
                        },
                      ];
                    }),
                  ),
                }
              : {}),
          },
        };

  const mcp = mcpServersToOpenCodeConfig(options.mcpServers);

  // Load the shared base + per-group fragments through OpenCode's native
  // instructions pipeline (session/instruction.ts). Absolute paths with
  // globs are supported. Files are read raw — `@./...` includes are NOT expanded
  // by OpenCode, so point at the concrete files, not at composed CLAUDE.md.
  //
  // Memory deliberately does NOT ride this array. OpenCode's instruction
  // pipeline calls instruction.system() on every model request and rereads
  // each file raw, so memory files listed here would be re-read (uncapped,
  // unrendered) on every request instead of following the shared
  // startup/clear/compact lifecycle. Memory is delivered by the registered
  // memory session hook instead — see createMemoryLifecycle below.
  const instructions = [
    '/app/CLAUDE.md',
    '/workspace/agent/.claude-fragments/*.md',
    '/workspace/agent/CLAUDE.local.md',
  ];

  const fullModel = model ? (model.includes('/') ? model : `${provider}/${model}`) : undefined;
  const fullSmallModel = smallModel ? (smallModel.includes('/') ? smallModel : `${provider}/${smallModel}`) : undefined;

  return {
    ...(fullModel ? { model: fullModel } : {}),
    ...(fullSmallModel ? { small_model: fullSmallModel } : {}),
    enabled_providers: [provider],
    // A flat `permission: 'allow'` string leaves every category — including
    // `question`, OpenCode's built-in interactive multi-choice tool — to
    // whatever OpenCode's own default/merge resolves it to. Server logs from
    // a live session showed that resolution land on BOTH `question -> deny *`
    // and `question -> allow *` for the same session: internally
    // contradictory, and whichever rule wins last, `allow` sometimes does —
    // and a headless container has no human to answer an interactive
    // question, so any path that lets it fire wedges the session forever
    // (see OpenCodeProvider's question.asked handling below for the runtime
    // belt-and-suspenders). Enumerate every known permission category
    // explicitly instead of relying on the wildcard string, so `question`
    // resolves to a single deterministic value — `deny` — that can never
    // contradict itself, while every other category keeps the prior
    // "allow everything" behavior.
    // A category OpenCode adds after this list was written is absent from it,
    // and so resolves to OpenCode's own default rather than to `allow`.
    permission: {
      read: 'allow',
      edit: 'allow',
      glob: 'allow',
      grep: 'allow',
      list: 'allow',
      bash: 'allow',
      task: 'allow',
      external_directory: 'allow',
      todowrite: 'allow',
      question: 'deny',
      webfetch: 'allow',
      websearch: 'allow',
      codesearch: 'allow',
      lsp: 'allow',
      doom_loop: 'allow',
      skill: 'allow',
    },
    autoupdate: false,
    snapshot: false,
    provider: providerOptions,
    instructions,
    mcp,
  };
}
