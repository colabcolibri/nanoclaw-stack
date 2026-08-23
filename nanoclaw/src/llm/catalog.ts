/**
 * Catálogo LLM — fonte de verdade versionada no repositório.
 * Para adicionar provider ou modelo: edite este arquivo e reinicie o NanoClaw.
 */
import type { InferenceParams } from '../inference-params.js';

export type LlmProtocol = 'openai-compatible' | 'anthropic';
export type LlmRecommendedRole = 'orchestrator' | 'worker' | 'sender' | 'memo' | 'all';

export interface LlmProviderCatalogEntry {
  id: string;
  name: string;
  baseUrl: string;
  completionUrl: string;
  keyEnvName: string;
  baseUrlEnvName: string | null;
  defaultModelId: string;
  protocol: LlmProtocol;
  defaultParams?: InferenceParams;
  sortOrder: number;
}

export interface LlmModelCatalogEntry {
  id: string;
  providerId: string;
  displayName: string;
  description?: string;
  recommendedRole?: LlmRecommendedRole;
  contextWindow: string;
  isRecommended?: boolean;
  inputPerMillion: number;
  outputPerMillion: number;
  cacheWritePerMillion: number;
  cacheHitPerMillion: number;
  savingsPct?: number;
  inferenceParams?: InferenceParams;
  sortOrder: number;
}

export const LLM_PROVIDER_CATALOG: LlmProviderCatalogEntry[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek Official (Direct Peak & Non-Peak)',
    baseUrl: 'https://api.deepseek.com',
    completionUrl: 'https://api.deepseek.com/chat/completions',
    keyEnvName: 'DEEPSEEK_API_KEY',
    baseUrlEnvName: 'DEEPSEEK_BASE_URL',
    defaultModelId: 'deepseek-v4-flash',
    protocol: 'openai-compatible',
    defaultParams: { temperature: 0.7, maxTokens: 8192 },
    sortOrder: 1,
  },
  {
    id: 'groq',
    name: 'Groq Cloud (Ultra-Low Latency Llama/DeepSeek)',
    baseUrl: 'https://api.groq.com/openai/v1',
    completionUrl: 'https://api.groq.com/openai/v1/chat/completions',
    keyEnvName: 'GROQ_API_KEY',
    baseUrlEnvName: 'GROQ_BASE_URL',
    defaultModelId: 'openai/gpt-oss-20b',
    protocol: 'openai-compatible',
    defaultParams: { temperature: 0.6, maxTokens: 4096 },
    sortOrder: 2,
  },
  {
    id: 'claude',
    name: 'Anthropic Claude Official (Direct API)',
    baseUrl: 'https://api.anthropic.com',
    completionUrl: 'https://api.anthropic.com/v1/messages',
    keyEnvName: 'ANTHROPIC_API_KEY',
    baseUrlEnvName: 'ANTHROPIC_BASE_URL',
    defaultModelId: 'claude-3-5-sonnet-latest',
    protocol: 'anthropic',
    sortOrder: 3,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter Aggregator (Multi-Model Gateway)',
    baseUrl: 'https://openrouter.ai/api/v1',
    completionUrl: 'https://openrouter.ai/api/v1/chat/completions',
    keyEnvName: 'OPENROUTER_API_KEY',
    baseUrlEnvName: 'OPENROUTER_BASE_URL',
    defaultModelId: 'deepseek/deepseek-chat',
    protocol: 'openai-compatible',
    defaultParams: { temperature: 0.7, maxTokens: 8192 },
    sortOrder: 4,
  },
  {
    id: 'opencode',
    name: 'OpenCode Local / Self-Hosted Gateway',
    baseUrl: 'http://127.0.0.1:4096',
    completionUrl: 'http://127.0.0.1:4096/v1/chat/completions',
    keyEnvName: 'OPENCODE_API_KEY',
    baseUrlEnvName: 'OPENCODE_BASE_URL',
    defaultModelId: 'claude-3-5-sonnet',
    protocol: 'openai-compatible',
    sortOrder: 5,
  },
];

export const LLM_MODEL_CATALOG: LlmModelCatalogEntry[] = [
  {
    id: 'deepseek-v4-flash',
    providerId: 'deepseek',
    displayName: 'DeepSeek V4 Flash (Ultra Fast)',
    recommendedRole: 'orchestrator',
    contextWindow: '128k',
    isRecommended: true,
    inputPerMillion: 0.44,
    outputPerMillion: 1.32,
    cacheWritePerMillion: 0.44,
    cacheHitPerMillion: 0.014,
    savingsPct: 97,
    inferenceParams: { temperature: 0.4, maxTokens: 2048 },
    sortOrder: 1,
  },
  {
    id: 'deepseek-chat',
    providerId: 'deepseek',
    displayName: 'DeepSeek V3 (Chat Standard)',
    recommendedRole: 'all',
    contextWindow: '128k',
    inputPerMillion: 0.44,
    outputPerMillion: 1.32,
    cacheWritePerMillion: 0.44,
    cacheHitPerMillion: 0.014,
    savingsPct: 97,
    sortOrder: 2,
  },
  {
    id: 'deepseek-v4-pro',
    providerId: 'deepseek',
    displayName: 'DeepSeek V4 Pro (Reasoning & Deep Analysis)',
    recommendedRole: 'sender',
    contextWindow: '128k',
    inputPerMillion: 1.32,
    outputPerMillion: 3.96,
    cacheWritePerMillion: 1.32,
    cacheHitPerMillion: 0.044,
    savingsPct: 97,
    inferenceParams: { temperature: 0.8, maxTokens: 4096 },
    sortOrder: 3,
  },
  {
    id: 'deepseek-reasoner',
    providerId: 'deepseek',
    displayName: 'DeepSeek R1 (Thinking CoT / Reasoning)',
    recommendedRole: 'worker',
    contextWindow: '128k',
    inputPerMillion: 1.32,
    outputPerMillion: 3.96,
    cacheWritePerMillion: 1.32,
    cacheHitPerMillion: 0.044,
    savingsPct: 97,
    inferenceParams: { temperature: 0.2, maxTokens: 8192 },
    sortOrder: 4,
  },
  {
    id: 'openai/gpt-oss-20b',
    providerId: 'groq',
    displayName: 'Grok 20B (Groq / gpt-oss-20b - Ultra Fast)',
    recommendedRole: 'orchestrator',
    contextWindow: '128k',
    isRecommended: true,
    inputPerMillion: 0.075,
    outputPerMillion: 0.3,
    cacheWritePerMillion: 0.075,
    cacheHitPerMillion: 0.075,
    savingsPct: 0,
    inferenceParams: { temperature: 0.3, maxTokens: 2048 },
    sortOrder: 1,
  },
  {
    id: 'openai/gpt-oss-120b',
    providerId: 'groq',
    displayName: 'Grok 120B (Groq / gpt-oss-120b - High Intelligence)',
    recommendedRole: 'worker',
    contextWindow: '128k',
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
    cacheWritePerMillion: 0.15,
    cacheHitPerMillion: 0.15,
    savingsPct: 0,
    sortOrder: 2,
  },
  {
    id: 'llama-3.3-70b-versatile',
    providerId: 'groq',
    displayName: 'Llama 3.3 70B Versatile (128k Context)',
    recommendedRole: 'all',
    contextWindow: '128k',
    inputPerMillion: 0.59,
    outputPerMillion: 0.79,
    cacheWritePerMillion: 0.59,
    cacheHitPerMillion: 0.59,
    savingsPct: 0,
    sortOrder: 3,
  },
  {
    id: 'llama-3.1-8b-instant',
    providerId: 'groq',
    displayName: 'Llama 3.1 8B Instant (Ultra Fast)',
    recommendedRole: 'memo',
    contextWindow: '128k',
    isRecommended: true,
    inputPerMillion: 0.05,
    outputPerMillion: 0.08,
    cacheWritePerMillion: 0.05,
    cacheHitPerMillion: 0.05,
    savingsPct: 0,
    inferenceParams: { temperature: 0.2, maxTokens: 256 },
    sortOrder: 4,
  },
  {
    id: 'deepseek-r1-distill-llama-70b',
    providerId: 'groq',
    displayName: 'DeepSeek R1 Distill Llama 70B (Reasoning)',
    recommendedRole: 'worker',
    contextWindow: '128k',
    inputPerMillion: 0.59,
    outputPerMillion: 0.79,
    cacheWritePerMillion: 0.59,
    cacheHitPerMillion: 0.59,
    savingsPct: 0,
    sortOrder: 5,
  },
  {
    id: 'claude-3-5-sonnet-latest',
    providerId: 'claude',
    displayName: 'Claude 3.5 Sonnet (State of the Art)',
    recommendedRole: 'all',
    contextWindow: '200k',
    isRecommended: true,
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheHitPerMillion: 0.3,
    savingsPct: 90,
    sortOrder: 1,
  },
  {
    id: 'claude-3-5-haiku-latest',
    providerId: 'claude',
    displayName: 'Claude 3.5 Haiku (Fast & Lightweight)',
    recommendedRole: 'orchestrator',
    contextWindow: '200k',
    inputPerMillion: 0.8,
    outputPerMillion: 4.0,
    cacheWritePerMillion: 1.0,
    cacheHitPerMillion: 0.08,
    savingsPct: 90,
    sortOrder: 2,
  },
  {
    id: 'claude-3-opus-latest',
    providerId: 'claude',
    displayName: 'Claude 3 Opus (Deep Complex Reasoning)',
    recommendedRole: 'worker',
    contextWindow: '200k',
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
    cacheWritePerMillion: 18.75,
    cacheHitPerMillion: 1.5,
    savingsPct: 90,
    sortOrder: 3,
  },
  {
    id: 'claude-3-7-sonnet-20250219',
    providerId: 'claude',
    displayName: 'Claude 3.7 Sonnet (Anthropic)',
    recommendedRole: 'all',
    contextWindow: '200k',
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheHitPerMillion: 0.3,
    savingsPct: 90,
    sortOrder: 4,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    providerId: 'claude',
    displayName: 'Claude 3.5 Haiku (Anthropic)',
    recommendedRole: 'orchestrator',
    contextWindow: '200k',
    inputPerMillion: 0.8,
    outputPerMillion: 4.0,
    cacheWritePerMillion: 1.0,
    cacheHitPerMillion: 0.08,
    savingsPct: 90,
    sortOrder: 5,
  },
  {
    id: 'deepseek/deepseek-chat',
    providerId: 'openrouter',
    displayName: 'OpenRouter / DeepSeek V3',
    recommendedRole: 'all',
    contextWindow: '64k',
    inputPerMillion: 0.44,
    outputPerMillion: 1.32,
    cacheWritePerMillion: 0.44,
    cacheHitPerMillion: 0.014,
    savingsPct: 97,
    sortOrder: 1,
  },
  {
    id: 'deepseek/deepseek-r1',
    providerId: 'openrouter',
    displayName: 'OpenRouter / DeepSeek R1',
    recommendedRole: 'worker',
    contextWindow: '64k',
    inputPerMillion: 1.32,
    outputPerMillion: 3.96,
    cacheWritePerMillion: 1.32,
    cacheHitPerMillion: 0.044,
    savingsPct: 97,
    sortOrder: 2,
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    providerId: 'openrouter',
    displayName: 'OpenRouter / Claude 3.5 Sonnet',
    recommendedRole: 'sender',
    contextWindow: '200k',
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheHitPerMillion: 0.3,
    savingsPct: 90,
    sortOrder: 3,
  },
  {
    id: 'anthropic/claude-3.7-sonnet',
    providerId: 'openrouter',
    displayName: 'OpenRouter / Claude 3.7 Sonnet',
    recommendedRole: 'all',
    contextWindow: '200k',
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheHitPerMillion: 0.3,
    savingsPct: 90,
    sortOrder: 4,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    providerId: 'openrouter',
    displayName: 'OpenRouter / Llama 3.3 70B',
    recommendedRole: 'worker',
    contextWindow: '128k',
    inputPerMillion: 0.59,
    outputPerMillion: 0.79,
    cacheWritePerMillion: 0.59,
    cacheHitPerMillion: 0.59,
    savingsPct: 0,
    sortOrder: 5,
  },
  {
    id: 'claude-3-5-sonnet',
    providerId: 'opencode',
    displayName: 'Local OpenCode / Claude 3.5 Sonnet',
    recommendedRole: 'all',
    contextWindow: '200k',
    isRecommended: true,
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 3.75,
    cacheHitPerMillion: 0.3,
    savingsPct: 90,
    sortOrder: 1,
  },
];

const providerIds = new Set(LLM_PROVIDER_CATALOG.map((p) => p.id));
for (const model of LLM_MODEL_CATALOG) {
  if (!providerIds.has(model.providerId)) {
    throw new Error(`Catálogo inválido: modelo "${model.id}" referencia provider inexistente "${model.providerId}"`);
  }
}
