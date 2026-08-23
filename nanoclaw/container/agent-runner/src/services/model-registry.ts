import fs from 'fs';
import path from 'path';
import {
  applyInferenceParamsToPayload,
  mergeInferenceParams,
  type InferenceParams,
} from '../inference-params.js';
import {
  resolveCallInferenceParams,
  type RoleInferenceOverrides,
} from './inference-resolver.js';
import type { LlmRole } from './role-models.js';

export type LlmProtocol = 'openai-compatible' | 'anthropic';

export interface ModelPricingRates {
  cacheHitPerMillion: number;
  cacheMissPerMillion: number;
  outputPerMillion: number;
}

export interface RegisteredModelInfo {
  id: string;
  name: string;
  providerId: string;
  description: string;
  recommendedRole?: 'orchestrator' | 'worker' | 'sender' | 'memo' | 'all';
  pricing: ModelPricingRates;
  contextWindow: string;
  completionUrl: string;
  keyEnvName: string;
  protocol: LlmProtocol;
  inferenceParams: InferenceParams;
}

export interface RegisteredProviderInfo {
  id: string;
  name: string;
  defaultBaseUrl: string;
  completionUrl: string;
  keyEnvName: string;
  protocol: LlmProtocol;
  defaultParams: InferenceParams;
  defaultModel: string;
}

export interface ModelInvocation {
  modelId: string;
  providerId: string;
  completionUrl: string;
  keyEnvName: string;
  protocol: LlmProtocol;
  params: InferenceParams;
}

interface MaterializedRegistryFile {
  providers?: Record<
    string,
    {
      name: string;
      defaultBaseUrl: string;
      completionUrl: string;
      keyEnvName: string;
      protocol: string;
      defaultParams?: InferenceParams;
      defaultModel: string;
      models: Array<{
        id: string;
        label: string;
        recommended?: boolean;
        recommendedRole?: string;
        inferenceParams?: InferenceParams;
        pricing: {
          inputPerMillion: number;
          outputPerMillion: number;
          cacheWritePerMillion: number;
          cacheHitPerMillion: number;
          contextWindow: string;
          savingsPct?: number;
        };
      }>;
    }
  >;
  modelsById?: Record<
    string,
    {
      id: string;
      providerId: string;
      displayName: string;
      completionUrl: string;
      keyEnvName: string;
      protocol: string;
      recommendedRole?: string;
      inferenceParams?: InferenceParams;
      pricing: {
        inputPerMillion: number;
        outputPerMillion: number;
        cacheWritePerMillion: number;
        cacheHitPerMillion: number;
        contextWindow: string;
        savingsPct?: number;
      };
    }
  >;
}

function requireNonEmpty(value: string | undefined | null, label: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Campo obrigatório ausente em llm-models.json: ${label}`);
  }
  return trimmed;
}

function parseProtocol(value: string, label: string): LlmProtocol {
  if (value === 'openai-compatible' || value === 'anthropic') {
    return value;
  }
  throw new Error(`Protocolo inválido em llm-models.json (${label}): "${value}"`);
}

export class ModelRegistry {
  private static models: Map<string, RegisteredModelInfo> = new Map();
  private static providers: Map<string, RegisteredProviderInfo> = new Map();
  private static loaded = false;

  private static registryFileCandidates(cwd?: string): string[] {
    const candidates: string[] = [];
    if (cwd) {
      candidates.push(cwd.endsWith('.json') ? cwd : path.join(cwd, 'llm-models.json'));
    }
    const nanoclawPath = process.env.NANOCLAW_DATA_DIR?.trim();
    if (nanoclawPath) {
      candidates.push(path.join(nanoclawPath, 'llm-models.json'));
    }
    candidates.push(
      '/workspace/agent/llm-models.json',
      path.join(process.cwd(), 'llm-models.json'),
      path.join(process.cwd(), 'data', 'llm-models.json'),
    );
    return candidates;
  }

  static loadFromDisk(cwd?: string): boolean {
    if (this.loaded && this.models.size > 0) return true;

    for (const filePath of this.registryFileCandidates(cwd)) {
      try {
        if (!fs.existsSync(filePath)) continue;
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MaterializedRegistryFile;
        this.ingestMaterialized(raw);
        this.loaded = true;
        return this.models.size > 0;
      } catch (err) {
        if (err instanceof Error && err.message.includes('llm-models.json')) {
          throw err;
        }
      }
    }
    return false;
  }

  private static ingestMaterialized(raw: MaterializedRegistryFile): void {
    this.models.clear();
    this.providers.clear();

    if (!raw.modelsById || Object.keys(raw.modelsById).length === 0) {
      throw new Error('llm-models.json inválido: modelsById ausente ou vazio');
    }

    if (raw.providers) {
      for (const [providerId, provider] of Object.entries(raw.providers)) {
        this.providers.set(providerId, {
          id: providerId,
          name: requireNonEmpty(provider.name, `providers.${providerId}.name`),
          defaultBaseUrl: requireNonEmpty(provider.defaultBaseUrl, `providers.${providerId}.defaultBaseUrl`),
          completionUrl: requireNonEmpty(provider.completionUrl, `providers.${providerId}.completionUrl`),
          keyEnvName: requireNonEmpty(provider.keyEnvName, `providers.${providerId}.keyEnvName`),
          protocol: parseProtocol(requireNonEmpty(provider.protocol, `providers.${providerId}.protocol`), providerId),
          defaultParams: provider.defaultParams ?? {},
          defaultModel: requireNonEmpty(provider.defaultModel, `providers.${providerId}.defaultModel`),
        });
      }
    }

    for (const m of Object.values(raw.modelsById)) {
      const provider = this.providers.get(m.providerId);
      const providerDefaults = provider?.defaultParams ?? {};
      const modelParams = m.inferenceParams ?? {};

      this.registerModel({
        id: requireNonEmpty(m.id, 'modelsById.id'),
        name: requireNonEmpty(m.displayName, `modelsById.${m.id}.displayName`),
        providerId: requireNonEmpty(m.providerId, `modelsById.${m.id}.providerId`),
        description: m.displayName,
        recommendedRole: m.recommendedRole as RegisteredModelInfo['recommendedRole'],
        completionUrl: requireNonEmpty(m.completionUrl, `modelsById.${m.id}.completionUrl`),
        keyEnvName: requireNonEmpty(m.keyEnvName, `modelsById.${m.id}.keyEnvName`),
        protocol: parseProtocol(requireNonEmpty(m.protocol, `modelsById.${m.id}.protocol`), m.id),
        inferenceParams: mergeInferenceParams(providerDefaults, modelParams),
        pricing: {
          cacheHitPerMillion: m.pricing.cacheHitPerMillion,
          cacheMissPerMillion: m.pricing.inputPerMillion,
          outputPerMillion: m.pricing.outputPerMillion,
        },
        contextWindow: requireNonEmpty(m.pricing.contextWindow, `modelsById.${m.id}.pricing.contextWindow`),
      });
    }
  }

  static registerModel(model: RegisteredModelInfo): void {
    this.models.set(model.id, model);
  }

  static getModel(id: string, cwd?: string): RegisteredModelInfo | null {
    this.loadFromDisk(cwd);
    return this.models.get(id) ?? null;
  }

  static getProvider(id: string, cwd?: string): RegisteredProviderInfo | null {
    this.loadFromDisk(cwd);
    return this.providers.get(id) ?? null;
  }

  static getAllModels(cwd?: string): RegisteredModelInfo[] {
    this.loadFromDisk(cwd);
    return Array.from(this.models.values());
  }

  /** Exige modelId configurado e presente no catálogo. */
  static requireModelId(modelId: string | undefined, fieldName: string, cwd?: string): string {
    const id = modelId?.trim();
    if (!id) {
      throw new Error(`${fieldName} não configurado em container.json`);
    }
    if (!this.loadFromDisk(cwd)) {
      throw new Error('llm-models.json não encontrado. Reinicie o NanoClaw para materializar o catálogo.');
    }
    if (!this.models.has(id)) {
      throw new Error(`Modelo "${id}" (${fieldName}) não existe no catálogo llm-models.json`);
    }
    return id;
  }

  /** Resolução por chamada: URL, key env, protocol, params. */
  static requireInvocation(modelId: string, cwd?: string): ModelInvocation {
    const id = this.requireModelId(modelId, 'model', cwd);
    const model = this.models.get(id)!;
    return {
      modelId: model.id,
      providerId: model.providerId,
      completionUrl: model.completionUrl,
      keyEnvName: model.keyEnvName,
      protocol: model.protocol,
      params: model.inferenceParams,
    };
  }

  static applyParamsToPayload(
    payload: Record<string, unknown>,
    modelId: string,
    ctx?: {
      cwd?: string;
      role?: LlmRole;
      purpose?: string | null;
      roleOverrides?: RoleInferenceOverrides;
      callOverride?: InferenceParams;
    },
  ): void {
    const params =
      ctx?.roleOverrides || ctx?.purpose || ctx?.callOverride || ctx?.role
        ? resolveCallInferenceParams({
            modelId,
            cwd: ctx?.cwd,
            role: ctx?.role,
            purpose: ctx?.purpose,
            roleOverrides: ctx?.roleOverrides,
            callOverride: ctx?.callOverride,
          })
        : this.requireInvocation(modelId, ctx?.cwd).params;
    applyInferenceParamsToPayload(payload, params);
  }

  /** @internal Apenas para testes unitários. */
  static seedForTests(models: RegisteredModelInfo[]): void {
    this.models.clear();
    this.providers.clear();
    for (const model of models) {
      this.registerModel(model);
    }
    this.loaded = true;
  }

  /** @internal Apenas para testes unitários. */
  static resetForTests(): void {
    this.models.clear();
    this.providers.clear();
    this.loaded = false;
  }
}
