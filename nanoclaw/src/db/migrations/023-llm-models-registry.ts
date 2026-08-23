import type { SqliteDatabase } from '../sqlite-compat.js';
import type { Migration } from './index.js';
import { LLM_MODEL_SEEDS, LLM_PROVIDER_SEEDS } from '../llm-models-seed.js';

export const migration023: Migration = {
  version: 23,
  name: 'llm-models-registry',
  up(db: SqliteDatabase) {
    db.exec(`
      CREATE TABLE llm_providers (
        id                  TEXT PRIMARY KEY,
        name                TEXT NOT NULL,
        base_url            TEXT NOT NULL,
        completion_url      TEXT NOT NULL,
        key_env_name        TEXT NOT NULL,
        base_url_env_name   TEXT,
        default_model_id    TEXT,
        is_active           INTEGER NOT NULL DEFAULT 1,
        sort_order          INTEGER NOT NULL DEFAULT 0,
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL
      );

      CREATE TABLE llm_models (
        id                      TEXT PRIMARY KEY,
        provider_id             TEXT NOT NULL REFERENCES llm_providers(id) ON DELETE CASCADE,
        display_name            TEXT NOT NULL,
        description             TEXT,
        recommended_role        TEXT,
        context_window          TEXT,
        is_recommended          INTEGER NOT NULL DEFAULT 0,
        input_per_million       REAL NOT NULL DEFAULT 0,
        output_per_million      REAL NOT NULL DEFAULT 0,
        cache_write_per_million REAL NOT NULL DEFAULT 0,
        cache_hit_per_million   REAL NOT NULL DEFAULT 0,
        savings_pct             INTEGER,
        is_active               INTEGER NOT NULL DEFAULT 1,
        sort_order              INTEGER NOT NULL DEFAULT 0,
        created_at              TEXT NOT NULL,
        updated_at              TEXT NOT NULL
      );

      CREATE INDEX idx_llm_models_provider ON llm_models(provider_id);
      CREATE INDEX idx_llm_models_active ON llm_models(is_active);
    `);

    const now = new Date().toISOString();
    const insertProvider = db.prepare(`
      INSERT OR IGNORE INTO llm_providers (
        id, name, base_url, completion_url, key_env_name, base_url_env_name,
        default_model_id, is_active, sort_order, created_at, updated_at
      ) VALUES (
        @id, @name, @base_url, @completion_url, @key_env_name, @base_url_env_name,
        @default_model_id, 1, @sort_order, @created_at, @updated_at
      )
    `);

    const insertModel = db.prepare(`
      INSERT OR IGNORE INTO llm_models (
        id, provider_id, display_name, description, recommended_role, context_window,
        is_recommended, input_per_million, output_per_million, cache_write_per_million,
        cache_hit_per_million, savings_pct, is_active, sort_order, created_at, updated_at
      ) VALUES (
        @id, @provider_id, @display_name, @description, @recommended_role, @context_window,
        @is_recommended, @input_per_million, @output_per_million, @cache_write_per_million,
        @cache_hit_per_million, @savings_pct, 1, @sort_order, @created_at, @updated_at
      )
    `);

    for (const p of LLM_PROVIDER_SEEDS) {
      insertProvider.run({
        id: p.id,
        name: p.name,
        base_url: p.baseUrl,
        completion_url: p.completionUrl,
        key_env_name: p.keyEnvName,
        base_url_env_name: p.baseUrlEnvName,
        default_model_id: p.defaultModelId,
        sort_order: p.sortOrder,
        created_at: now,
        updated_at: now,
      });
    }

    for (const m of LLM_MODEL_SEEDS) {
      insertModel.run({
        id: m.id,
        provider_id: m.providerId,
        display_name: m.displayName,
        description: m.description ?? null,
        recommended_role: m.recommendedRole ?? null,
        context_window: m.contextWindow ?? null,
        is_recommended: m.isRecommended ? 1 : 0,
        input_per_million: m.inputPerMillion,
        output_per_million: m.outputPerMillion,
        cache_write_per_million: m.cacheWritePerMillion,
        cache_hit_per_million: m.cacheHitPerMillion,
        savings_pct: m.savingsPct ?? null,
        sort_order: m.sortOrder,
        created_at: now,
        updated_at: now,
      });
    }
  },
};
