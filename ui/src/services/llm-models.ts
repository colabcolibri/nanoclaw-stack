import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "../config.js";

export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheWritePerMillion: number;
  cacheHitPerMillion: number;
  contextWindow: string;
  savingsPct?: number;
}

export interface ModelItem {
  id: string;
  label: string;
  recommended?: boolean;
  recommendedRole?: "orchestrator" | "worker" | "sender" | "all";
  pricing: ModelPricing;
}

export interface ProviderMeta {
  name: string;
  defaultBaseUrl: string;
  completionUrl?: string;
  keyEnvName?: string;
  defaultModel: string;
  models: ModelItem[];
}

export interface LlmRegistryResponse {
  updatedAt: string;
  providers: Record<string, ProviderMeta>;
}

export class LlmModelService {
  private static ensureTables(db: Database): void {
    db.run(`
      CREATE TABLE IF NOT EXISTS llm_providers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        completion_url TEXT NOT NULL,
        key_env_name TEXT NOT NULL,
        base_url_env_name TEXT,
        default_model_id TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS llm_models (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        description TEXT,
        recommended_role TEXT,
        context_window TEXT,
        is_recommended INTEGER NOT NULL DEFAULT 0,
        input_per_million REAL NOT NULL DEFAULT 0,
        output_per_million REAL NOT NULL DEFAULT 0,
        cache_write_per_million REAL NOT NULL DEFAULT 0,
        cache_hit_per_million REAL NOT NULL DEFAULT 0,
        savings_pct INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  static getRegistry(): LlmRegistryResponse {
    if (!fs.existsSync(CONFIG.DB_PATH)) {
      return { updatedAt: new Date().toISOString(), providers: {} };
    }

    const db = new Database(CONFIG.DB_PATH, { readonly: true });
    try {
      this.ensureTables(db);

      const providers = db
        .query(`SELECT * FROM llm_providers WHERE is_active = 1 ORDER BY sort_order, name`)
        .all() as any[];

      const models = db
        .query(`SELECT * FROM llm_models WHERE is_active = 1 ORDER BY provider_id, sort_order, display_name`)
        .all() as any[];

      const providerMap: Record<string, ProviderMeta> = {};

      for (const p of providers) {
        providerMap[p.id] = {
          name: p.name,
          defaultBaseUrl: p.base_url,
          completionUrl: p.completion_url,
          defaultModel: p.default_model_id || "",
          keyEnvName: p.key_env_name || undefined,
          models: [],
        };
      }

      for (const m of models) {
        const bucket = providerMap[m.provider_id];
        if (!bucket) continue;
        bucket.models.push({
          id: m.id,
          label: m.display_name,
          recommended: m.is_recommended === 1,
          recommendedRole: m.recommended_role || undefined,
          pricing: {
            inputPerMillion: m.input_per_million,
            outputPerMillion: m.output_per_million,
            cacheWritePerMillion: m.cache_write_per_million,
            cacheHitPerMillion: m.cache_hit_per_million,
            contextWindow: m.context_window || "128k",
            savingsPct: m.savings_pct ?? undefined,
          },
        });
      }

      return { updatedAt: new Date().toISOString(), providers: providerMap };
    } finally {
      db.close();
    }
  }

  static upsertModel(input: {
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
  }): void {
    if (!fs.existsSync(CONFIG.DB_PATH)) throw new Error("Database not found");
    const db = new Database(CONFIG.DB_PATH);
    const now = new Date().toISOString();
    try {
      this.ensureTables(db);
      db.run(
        `INSERT INTO llm_models (
          id, provider_id, display_name, description, recommended_role, context_window,
          is_recommended, input_per_million, output_per_million, cache_write_per_million,
          cache_hit_per_million, savings_pct, is_active, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          provider_id = excluded.provider_id,
          display_name = excluded.display_name,
          description = excluded.description,
          recommended_role = excluded.recommended_role,
          context_window = excluded.context_window,
          is_recommended = excluded.is_recommended,
          input_per_million = excluded.input_per_million,
          output_per_million = excluded.output_per_million,
          cache_write_per_million = excluded.cache_write_per_million,
          cache_hit_per_million = excluded.cache_hit_per_million,
          savings_pct = excluded.savings_pct,
          sort_order = excluded.sort_order,
          updated_at = excluded.updated_at`,
        [
          input.id,
          input.providerId,
          input.displayName,
          input.description ?? null,
          input.recommendedRole ?? null,
          input.contextWindow ?? null,
          input.isRecommended ? 1 : 0,
          input.inputPerMillion,
          input.outputPerMillion,
          input.cacheWritePerMillion,
          input.cacheHitPerMillion,
          input.savingsPct ?? null,
          input.sortOrder ?? 0,
          now,
          now,
        ]
      );
      this.materializeJson(db);
    } finally {
      db.close();
    }
  }

  static upsertProvider(input: {
    id: string;
    name: string;
    baseUrl: string;
    completionUrl: string;
    keyEnvName: string;
    baseUrlEnvName?: string;
    defaultModelId?: string;
    sortOrder?: number;
  }): void {
    if (!fs.existsSync(CONFIG.DB_PATH)) throw new Error("Database not found");
    const db = new Database(CONFIG.DB_PATH);
    const now = new Date().toISOString();
    try {
      this.ensureTables(db);
      db.run(
        `INSERT INTO llm_providers (
          id, name, base_url, completion_url, key_env_name, base_url_env_name,
          default_model_id, is_active, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          base_url = excluded.base_url,
          completion_url = excluded.completion_url,
          key_env_name = excluded.key_env_name,
          base_url_env_name = excluded.base_url_env_name,
          default_model_id = excluded.default_model_id,
          sort_order = excluded.sort_order,
          updated_at = excluded.updated_at`,
        [
          input.id,
          input.name,
          input.baseUrl,
          input.completionUrl,
          input.keyEnvName,
          input.baseUrlEnvName ?? null,
          input.defaultModelId ?? null,
          input.sortOrder ?? 0,
          now,
          now,
        ]
      );
      this.materializeJson(db);
    } finally {
      db.close();
    }
  }

  static deactivateModel(id: string): void {
    if (!fs.existsSync(CONFIG.DB_PATH)) throw new Error("Database not found");
    const db = new Database(CONFIG.DB_PATH);
    const now = new Date().toISOString();
    try {
      db.run(`UPDATE llm_models SET is_active = 0, updated_at = ? WHERE id = ?`, [now, id]);
      this.materializeJson(db);
    } finally {
      db.close();
    }
  }

  static deactivateProvider(id: string): void {
    if (!fs.existsSync(CONFIG.DB_PATH)) throw new Error("Database not found");
    const db = new Database(CONFIG.DB_PATH);
    const now = new Date().toISOString();
    try {
      db.run(`UPDATE llm_providers SET is_active = 0, updated_at = ? WHERE id = ?`, [now, id]);
      db.run(`UPDATE llm_models SET is_active = 0, updated_at = ? WHERE provider_id = ?`, [now, id]);
      this.materializeJson(db);
    } finally {
      db.close();
    }
  }

  static updateModelPricing(
    id: string,
    pricing: {
      inputPerMillion: number;
      outputPerMillion: number;
      cacheWritePerMillion: number;
      cacheHitPerMillion: number;
      savingsPct?: number;
    }
  ): void {
    if (!fs.existsSync(CONFIG.DB_PATH)) throw new Error("Database not found");
    const db = new Database(CONFIG.DB_PATH);
    const now = new Date().toISOString();
    try {
      db.run(
        `UPDATE llm_models SET
          input_per_million = ?, output_per_million = ?,
          cache_write_per_million = ?, cache_hit_per_million = ?,
          savings_pct = ?, updated_at = ?
        WHERE id = ?`,
        [
          pricing.inputPerMillion,
          pricing.outputPerMillion,
          pricing.cacheWritePerMillion,
          pricing.cacheHitPerMillion,
          pricing.savingsPct ?? null,
          now,
          id,
        ]
      );
      this.materializeJson(db);
    } finally {
      db.close();
    }
  }

  private static materializeJson(db: Database): void {
    const providers = db
      .query(`SELECT * FROM llm_providers WHERE is_active = 1 ORDER BY sort_order, name`)
      .all() as any[];
    const models = db
      .query(`SELECT * FROM llm_models WHERE is_active = 1 ORDER BY provider_id, sort_order, display_name`)
      .all() as any[];

    const providerMap: Record<string, any> = {};
    const modelsById: Record<string, any> = {};

    for (const p of providers) {
      providerMap[p.id] = {
        name: p.name,
        defaultBaseUrl: p.base_url,
        completionUrl: p.completion_url,
        keyEnvName: p.key_env_name,
        baseUrlEnvName: p.base_url_env_name,
        defaultModel: p.default_model_id || "",
        models: [],
      };
    }

    for (const m of models) {
      const provider = providerMap[m.provider_id];
      if (!provider) continue;
      const item = {
        id: m.id,
        label: m.display_name,
        recommended: m.is_recommended === 1,
        recommendedRole: m.recommended_role || undefined,
        pricing: {
          inputPerMillion: m.input_per_million,
          outputPerMillion: m.output_per_million,
          cacheWritePerMillion: m.cache_write_per_million,
          cacheHitPerMillion: m.cache_hit_per_million,
          contextWindow: m.context_window || "128k",
          savingsPct: m.savings_pct ?? undefined,
        },
      };
      provider.models.push(item);
      modelsById[m.id] = {
        id: m.id,
        providerId: m.provider_id,
        displayName: m.display_name,
        completionUrl: provider.completionUrl,
        recommendedRole: m.recommended_role || undefined,
        pricing: item.pricing,
      };
    }

    const payload = {
      updatedAt: new Date().toISOString(),
      providers: providerMap,
      modelsById,
    };

    if (!fs.existsSync(CONFIG.DATA_PATH)) {
      fs.mkdirSync(CONFIG.DATA_PATH, { recursive: true });
    }
    fs.writeFileSync(path.join(CONFIG.DATA_PATH, "llm-models.json"), JSON.stringify(payload, null, 2) + "\n", "utf-8");
  }
}
