import fs from 'fs';
import path from 'path';

import { DATA_DIR } from './config.js';
import { getAllLlmModels, getAllLlmProviders } from './db/llm-models.js';
import { log } from './log.js';

export interface MaterializedLlmRegistry {
  updatedAt: string;
  providers: Record<
    string,
    {
      name: string;
      defaultBaseUrl: string;
      completionUrl: string;
      keyEnvName: string;
      baseUrlEnvName: string | null;
      defaultModel: string;
      protocol: string;
      defaultParams: Record<string, unknown>;
      models: Array<{
        id: string;
        label: string;
        recommended?: boolean;
        recommendedRole?: string;
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
  modelsById: Record<
    string,
    {
      id: string;
      providerId: string;
      displayName: string;
      completionUrl: string;
      keyEnvName: string;
      protocol: string;
      recommendedRole?: string;
      inferenceParams: Record<string, unknown>;
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

function requireField<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined || value === '') {
    throw new Error(`Campo obrigatório ausente no catálogo LLM: ${label}`);
  }
  return value;
}

export function buildLlmRegistryPayload(): MaterializedLlmRegistry {
  const providers = getAllLlmProviders(true);
  const models = getAllLlmModels(true);
  const providerMap: MaterializedLlmRegistry['providers'] = {};
  const modelsById: MaterializedLlmRegistry['modelsById'] = {};

  for (const p of providers) {
    providerMap[p.id] = {
      name: requireField(p.name, `provider.${p.id}.name`),
      defaultBaseUrl: requireField(p.base_url, `provider.${p.id}.base_url`),
      completionUrl: requireField(p.completion_url, `provider.${p.id}.completion_url`),
      keyEnvName: requireField(p.key_env_name, `provider.${p.id}.key_env_name`),
      baseUrlEnvName: p.base_url_env_name,
      defaultModel: requireField(p.default_model_id, `provider.${p.id}.default_model_id`),
      protocol: requireField(p.protocol, `provider.${p.id}.protocol`),
      defaultParams: p.default_params ? JSON.parse(p.default_params) : {},
      models: [],
    };
  }

  for (const m of models) {
    const provider = providerMap[m.provider_id];
    if (!provider) {
      throw new Error(`Modelo "${m.id}" referencia provider desconhecido "${m.provider_id}"`);
    }
    if (!m.context_window?.trim()) {
      throw new Error(`Modelo "${m.id}" sem context_window definido no catálogo`);
    }

    const item = {
      id: m.id,
      label: m.display_name,
      recommended: m.is_recommended === 1,
      recommendedRole: m.recommended_role ?? undefined,
      pricing: {
        inputPerMillion: m.input_per_million,
        outputPerMillion: m.output_per_million,
        cacheWritePerMillion: m.cache_write_per_million,
        cacheHitPerMillion: m.cache_hit_per_million,
        contextWindow: m.context_window,
        savingsPct: m.savings_pct ?? undefined,
      },
    };

    provider.models.push(item);
    modelsById[m.id] = {
      id: m.id,
      providerId: m.provider_id,
      displayName: m.display_name,
      completionUrl: provider.completionUrl,
      keyEnvName: provider.keyEnvName,
      protocol: provider.protocol,
      recommendedRole: m.recommended_role ?? undefined,
      inferenceParams: m.inference_params ? JSON.parse(m.inference_params) : {},
      pricing: item.pricing,
    };
  }

  return {
    updatedAt: new Date().toISOString(),
    providers: providerMap,
    modelsById,
  };
}

/** Writes data/llm-models.json for container runtime and UI cache. */
export function materializeLlmModelsJson(): MaterializedLlmRegistry {
  const payload = buildLlmRegistryPayload();
  const outPath = path.join(DATA_DIR, 'llm-models.json');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
  log.info('Materialized LLM models registry', { path: outPath, models: Object.keys(payload.modelsById).length });
  return payload;
}

export function readMaterializedLlmRegistry(): MaterializedLlmRegistry | null {
  const outPath = path.join(DATA_DIR, 'llm-models.json');
  if (!fs.existsSync(outPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(outPath, 'utf-8')) as MaterializedLlmRegistry;
  } catch {
    return null;
  }
}
