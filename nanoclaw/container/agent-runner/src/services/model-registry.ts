import fs from 'fs';
import path from 'path';

export interface ModelPricingRates {
  cacheHitPerMillion: number;
  cacheMissPerMillion: number;
  outputPerMillion: number;
}

export interface RegisteredModelInfo {
  id: string;
  name: string;
  provider: 'deepseek' | 'groq' | 'claude' | 'openrouter' | 'opencode' | 'openai' | string;
  description: string;
  recommendedRole?: 'orchestrator' | 'worker' | 'sender' | 'all';
  pricing: ModelPricingRates;
  contextWindow?: string;
  isCustom?: boolean;
}

export interface ProviderKeyInfo {
  provider: string;
  keyEnvName: string;
  baseUrlEnvName: string;
  defaultBaseUrl: string;
  defaultModel: string;
}

export const PROVIDER_ENV_SPECS: Record<string, ProviderKeyInfo> = {
  deepseek: {
    provider: 'deepseek',
    keyEnvName: 'DEEPSEEK_API_KEY',
    baseUrlEnvName: 'DEEPSEEK_BASE_URL',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
  },
  groq: {
    provider: 'groq',
    keyEnvName: 'GROQ_API_KEY',
    baseUrlEnvName: 'GROQ_BASE_URL',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  claude: {
    provider: 'claude',
    keyEnvName: 'ANTHROPIC_API_KEY',
    baseUrlEnvName: 'ANTHROPIC_BASE_URL',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-7-sonnet-20250219',
  },
  openrouter: {
    provider: 'openrouter',
    keyEnvName: 'OPENROUTER_API_KEY',
    baseUrlEnvName: 'OPENROUTER_BASE_URL',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'deepseek/deepseek-chat',
  },
  opencode: {
    provider: 'opencode',
    keyEnvName: 'OPENCODE_API_KEY',
    baseUrlEnvName: 'OPENCODE_BASE_URL',
    defaultBaseUrl: 'http://127.0.0.1:4096',
    defaultModel: 'local-model',
  },
};

export class ModelRegistry {
  private static models: Map<string, RegisteredModelInfo> = new Map();

  static {
    this.initializeDefaults();
  }

  static initializeDefaults(): void {
    this.models.clear();

    // DeepSeek Models
    this.registerModel({
      id: 'deepseek-chat',
      name: 'DeepSeek V3 (Chat & Execution)',
      provider: 'deepseek',
      description: 'Modelo padrão equilibrado de altíssima velocidade e excelente suporte a tool calls.',
      recommendedRole: 'all',
      pricing: { cacheHitPerMillion: 0.014, cacheMissPerMillion: 0.44, outputPerMillion: 1.32 },
      contextWindow: '128k',
    });

    this.registerModel({
      id: 'deepseek-v4-flash',
      name: 'DeepSeek Flash (Ultra Rápido)',
      provider: 'deepseek',
      description: 'Ideal para orquestração, triagem rápida e respostas diretas.',
      recommendedRole: 'orchestrator',
      pricing: { cacheHitPerMillion: 0.014, cacheMissPerMillion: 0.44, outputPerMillion: 1.32 },
      contextWindow: '128k',
    });

    this.registerModel({
      id: 'deepseek-reasoner',
      name: 'DeepSeek R1 (Raciocínio & CoT)',
      provider: 'deepseek',
      description: 'Modelo de raciocínio profundo. Ideal para tarefas analíticas complexas e cálculos.',
      recommendedRole: 'worker',
      pricing: { cacheHitPerMillion: 0.044, cacheMissPerMillion: 1.32, outputPerMillion: 3.96 },
      contextWindow: '128k',
    });

    this.registerModel({
      id: 'deepseek-v4-pro',
      name: 'DeepSeek Pro (Análise Avançada)',
      provider: 'deepseek',
      description: 'Alta capacidade de síntese e resolução técnica.',
      recommendedRole: 'sender',
      pricing: { cacheHitPerMillion: 0.044, cacheMissPerMillion: 1.32, outputPerMillion: 3.96 },
      contextWindow: '128k',
    });

    // Groq Models
    this.registerModel({
      id: 'llama-3.3-70b-versatile',
      name: 'Llama 3.3 70B Versatile (Groq)',
      provider: 'groq',
      description: 'Velocidade extrema de geração com alta inteligência geral.',
      recommendedRole: 'all',
      pricing: { cacheHitPerMillion: 0.59, cacheMissPerMillion: 0.59, outputPerMillion: 0.79 },
      contextWindow: '128k',
    });

    this.registerModel({
      id: 'openai/gpt-oss-120b',
      name: 'Grok 120B (Groq)',
      provider: 'groq',
      description: 'Modelo de alto porte no hardware LPU da Groq.',
      recommendedRole: 'worker',
      pricing: { cacheHitPerMillion: 0.15, cacheMissPerMillion: 0.15, outputPerMillion: 0.60 },
      contextWindow: '128k',
    });

    this.registerModel({
      id: 'openai/gpt-oss-20b',
      name: 'Grok 20B (Groq Flash)',
      provider: 'groq',
      description: 'Latência quase instantânea para orquestração e fast-path.',
      recommendedRole: 'orchestrator',
      pricing: { cacheHitPerMillion: 0.075, cacheMissPerMillion: 0.075, outputPerMillion: 0.30 },
      contextWindow: '128k',
    });

    this.registerModel({
      id: 'deepseek-r1-distill-llama-70b',
      name: 'DeepSeek R1 Distill 70B (Groq)',
      provider: 'groq',
      description: 'Raciocínio R1 executado em ultra-velocidade na Groq.',
      recommendedRole: 'worker',
      pricing: { cacheHitPerMillion: 0.59, cacheMissPerMillion: 0.59, outputPerMillion: 0.79 },
      contextWindow: '128k',
    });

    this.registerModel({
      id: 'llama-3.1-8b-instant',
      name: 'Llama 3.1 8B Instant (Groq)',
      provider: 'groq',
      description: 'Micro modelo para validações e checagens ultrarrápidas.',
      recommendedRole: 'orchestrator',
      pricing: { cacheHitPerMillion: 0.05, cacheMissPerMillion: 0.05, outputPerMillion: 0.08 },
      contextWindow: '128k',
    });

    // Claude / Anthropic Models
    this.registerModel({
      id: 'claude-3-7-sonnet-20250219',
      name: 'Claude 3.7 Sonnet (Anthropic)',
      provider: 'claude',
      description: 'Inteligência de ponta para código, personas refinadas e raciocínio híbrido.',
      recommendedRole: 'all',
      pricing: { cacheHitPerMillion: 0.30, cacheMissPerMillion: 3.00, outputPerMillion: 15.00 },
      contextWindow: '200k',
    });

    this.registerModel({
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku (Anthropic)',
      provider: 'claude',
      description: 'Execução rápida e econômica de alta precisão.',
      recommendedRole: 'orchestrator',
      pricing: { cacheHitPerMillion: 0.08, cacheMissPerMillion: 0.80, outputPerMillion: 4.00 },
      contextWindow: '200k',
    });
  }

  static registerModel(model: RegisteredModelInfo): void {
    this.models.set(model.id, model);
  }

  static getModel(id: string): RegisteredModelInfo | null {
    return this.models.get(id) || null;
  }

  static getModelsByProvider(provider: string): RegisteredModelInfo[] {
    return Array.from(this.models.values()).filter((m) => m.provider === provider);
  }

  static getAllModels(): RegisteredModelInfo[] {
    return Array.from(this.models.values());
  }

  /**
   * Defensively resolves the model to use for any role or agent.
   * Priority:
   * 1. Explicit model specified on agent / request (if valid)
   * 2. Configured role model (orchestrator / sender)
   * 3. Configured container default model
   * 4. Provider default model
   * 5. Safe absolute fallback ('deepseek-chat')
   */
  static resolveModel(
    explicitModel?: string,
    roleDefault?: string,
    containerDefault?: string,
    providerDefault?: string
  ): string {
    if (explicitModel && explicitModel.trim()) {
      return explicitModel.trim();
    }
    if (roleDefault && roleDefault.trim()) {
      return roleDefault.trim();
    }
    if (containerDefault && containerDefault.trim()) {
      return containerDefault.trim();
    }
    if (providerDefault && providerDefault.trim()) {
      return providerDefault.trim();
    }
    return 'deepseek-chat';
  }
}
