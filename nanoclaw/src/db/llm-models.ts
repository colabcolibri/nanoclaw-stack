import { getDb } from './connection.js';

export interface LlmProviderRow {
  id: string;
  name: string;
  base_url: string;
  completion_url: string;
  key_env_name: string;
  base_url_env_name: string | null;
  default_model_id: string | null;
  protocol: string;
  api_key_ciphertext: string | null;
  default_params: string | null;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface LlmModelRow {
  id: string;
  provider_id: string;
  display_name: string;
  description: string | null;
  recommended_role: string | null;
  context_window: string | null;
  inference_params: string | null;
  is_recommended: number;
  input_per_million: number;
  output_per_million: number;
  cache_write_per_million: number;
  cache_hit_per_million: number;
  savings_pct: number | null;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface LlmModelInput {
  id: string;
  providerId: string;
  displayName: string;
  description?: string;
  recommendedRole?: string;
  contextWindow?: string;
  isRecommended?: boolean;
  inputPerMillion: number;
  outputPerMillion: number;
  cacheWritePerMillion: number;
  cacheHitPerMillion: number;
  savingsPct?: number;
  sortOrder?: number;
  isActive?: boolean;
  inferenceParams?: Record<string, unknown>;
}

export interface LlmProviderInput {
  id: string;
  name: string;
  baseUrl: string;
  completionUrl: string;
  keyEnvName: string;
  baseUrlEnvName?: string;
  defaultModelId?: string;
  protocol?: string;
  defaultParams?: Record<string, unknown>;
  sortOrder?: number;
  isActive?: boolean;
}

export function getAllLlmProviders(activeOnly = true): LlmProviderRow[] {
  const sql = activeOnly
    ? 'SELECT * FROM llm_providers WHERE is_active = 1 ORDER BY sort_order, name'
    : 'SELECT * FROM llm_providers ORDER BY sort_order, name';
  return getDb().prepare(sql).all() as LlmProviderRow[];
}

export function getAllLlmModels(activeOnly = true): LlmModelRow[] {
  const sql = activeOnly
    ? 'SELECT * FROM llm_models WHERE is_active = 1 ORDER BY provider_id, sort_order, display_name'
    : 'SELECT * FROM llm_models ORDER BY provider_id, sort_order, display_name';
  return getDb().prepare(sql).all() as LlmModelRow[];
}

export function getLlmModel(id: string): LlmModelRow | undefined {
  return getDb().prepare('SELECT * FROM llm_models WHERE id = ?').get(id) as LlmModelRow | undefined;
}

export function upsertLlmProvider(input: LlmProviderInput): void {
  if (!input.protocol?.trim()) {
    throw new Error(`protocol is required for provider "${input.id}"`);
  }
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO llm_providers (
        id, name, base_url, completion_url, key_env_name, base_url_env_name,
        default_model_id, protocol, default_params, is_active, sort_order, created_at, updated_at
      ) VALUES (
        @id, @name, @base_url, @completion_url, @key_env_name, @base_url_env_name,
        @default_model_id, @protocol, @default_params, @is_active, @sort_order, @created_at, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        base_url = excluded.base_url,
        completion_url = excluded.completion_url,
        key_env_name = excluded.key_env_name,
        base_url_env_name = excluded.base_url_env_name,
        default_model_id = excluded.default_model_id,
        protocol = excluded.protocol,
        default_params = excluded.default_params,
        is_active = excluded.is_active,
        sort_order = excluded.sort_order,
        updated_at = excluded.updated_at`,
    )
    .run({
      id: input.id,
      name: input.name,
      base_url: input.baseUrl,
      completion_url: input.completionUrl,
      key_env_name: input.keyEnvName,
      base_url_env_name: input.baseUrlEnvName ?? null,
      default_model_id: input.defaultModelId ?? null,
      protocol: input.protocol,
      default_params: input.defaultParams ? JSON.stringify(input.defaultParams) : null,
      is_active: input.isActive === false ? 0 : 1,
      sort_order: input.sortOrder ?? 0,
      created_at: now,
      updated_at: now,
    });
}

export function upsertLlmModel(input: LlmModelInput): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO llm_models (
        id, provider_id, display_name, description, recommended_role, context_window,
        inference_params, is_recommended, input_per_million, output_per_million, cache_write_per_million,
        cache_hit_per_million, savings_pct, is_active, sort_order, created_at, updated_at
      ) VALUES (
        @id, @provider_id, @display_name, @description, @recommended_role, @context_window,
        @inference_params, @is_recommended, @input_per_million, @output_per_million, @cache_write_per_million,
        @cache_hit_per_million, @savings_pct, @is_active, @sort_order, @created_at, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        provider_id = excluded.provider_id,
        display_name = excluded.display_name,
        description = excluded.description,
        recommended_role = excluded.recommended_role,
        context_window = excluded.context_window,
        inference_params = excluded.inference_params,
        is_recommended = excluded.is_recommended,
        input_per_million = excluded.input_per_million,
        output_per_million = excluded.output_per_million,
        cache_write_per_million = excluded.cache_write_per_million,
        cache_hit_per_million = excluded.cache_hit_per_million,
        savings_pct = excluded.savings_pct,
        is_active = excluded.is_active,
        sort_order = excluded.sort_order,
        updated_at = excluded.updated_at`,
    )
    .run({
      id: input.id,
      provider_id: input.providerId,
      display_name: input.displayName,
      description: input.description ?? null,
      recommended_role: input.recommendedRole ?? null,
      context_window: input.contextWindow ?? null,
      inference_params: input.inferenceParams ? JSON.stringify(input.inferenceParams) : null,
      is_recommended: input.isRecommended ? 1 : 0,
      input_per_million: input.inputPerMillion,
      output_per_million: input.outputPerMillion,
      cache_write_per_million: input.cacheWritePerMillion,
      cache_hit_per_million: input.cacheHitPerMillion,
      savings_pct: input.savingsPct ?? null,
      is_active: input.isActive === false ? 0 : 1,
      sort_order: input.sortOrder ?? 0,
      created_at: now,
      updated_at: now,
    });
}

export function updateLlmModelPricing(
  id: string,
  pricing: Pick<LlmModelInput, 'inputPerMillion' | 'outputPerMillion' | 'cacheWritePerMillion' | 'cacheHitPerMillion' | 'savingsPct'>,
): void {
  getDb()
    .prepare(
      `UPDATE llm_models SET
        input_per_million = @input_per_million,
        output_per_million = @output_per_million,
        cache_write_per_million = @cache_write_per_million,
        cache_hit_per_million = @cache_hit_per_million,
        savings_pct = @savings_pct,
        updated_at = @updated_at
      WHERE id = @id`,
    )
    .run({
      id,
      input_per_million: pricing.inputPerMillion,
      output_per_million: pricing.outputPerMillion,
      cache_write_per_million: pricing.cacheWritePerMillion,
      cache_hit_per_million: pricing.cacheHitPerMillion,
      savings_pct: pricing.savingsPct ?? null,
      updated_at: new Date().toISOString(),
    });
}
