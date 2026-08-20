import fs from 'fs';
import path from 'path';
import { Database } from 'bun:sqlite';
import { CurrencyService } from './currency.js';

export interface DeepSeekUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

export interface ModelRate {
  cacheHitPerMillion: number;
  cacheMissPerMillion: number;
  outputPerMillion: number;
}

export const MODEL_PRICING: Record<string, ModelRate> = {
  'deepseek-v4-flash': {
    cacheHitPerMillion: 0.014, // Peak: $0.014 / 1M
    cacheMissPerMillion: 0.44, // Peak: $0.44 / 1M
    outputPerMillion: 1.32,    // Peak: $1.32 / 1M
  },
  'deepseek-chat': {
    cacheHitPerMillion: 0.014,
    cacheMissPerMillion: 0.44,
    outputPerMillion: 1.32,
  },
  'deepseek-v4-pro': {
    cacheHitPerMillion: 0.044, // Peak: $0.044 / 1M
    cacheMissPerMillion: 1.32, // Peak: $1.32 / 1M
    outputPerMillion: 3.96,    // Peak: $3.96 / 1M
  },
  'deepseek-reasoner': {
    cacheHitPerMillion: 0.044,
    cacheMissPerMillion: 1.32,
    outputPerMillion: 3.96,
  },
  'openai/gpt-oss-120b': {
    cacheHitPerMillion: 0.15,
    cacheMissPerMillion: 0.15,
    outputPerMillion: 0.60,
  },
  'openai/gpt-oss-20b': {
    cacheHitPerMillion: 0.075,
    cacheMissPerMillion: 0.075,
    outputPerMillion: 0.30,
  },
  'llama-3.3-70b-versatile': {
    cacheHitPerMillion: 0.59,
    cacheMissPerMillion: 0.59,
    outputPerMillion: 0.79,
  },
  'llama-3.1-8b-instant': {
    cacheHitPerMillion: 0.05,
    cacheMissPerMillion: 0.05,
    outputPerMillion: 0.08,
  },
  'deepseek-r1-distill-llama-70b': {
    cacheHitPerMillion: 0.59,
    cacheMissPerMillion: 0.59,
    outputPerMillion: 0.79,
  },
  'mixtral-8x7b-32768': {
    cacheHitPerMillion: 0.24,
    cacheMissPerMillion: 0.24,
    outputPerMillion: 0.24,
  },
};

export const DEEPSEEK_PRICING = MODEL_PRICING;

export interface TokenRecord {
  id: string;
  timestamp: string;
  model: string;
  messageId?: string;
  purpose?: string;
  promptTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  completionTokens: number;
  totalTokens: number;
  rateHitPerMillion: number;
  rateMissPerMillion: number;
  rateOutPerMillion: number;
  costUsd: number;
  costBrl: number;
  hasToolCalls: boolean;
  toolCallsCount: number;
  latencyMs?: number;
  preview?: string;
}

export class TokenLedger {
  /**
   * Calculates exact cost using DeepSeek official Peak pricing table.
   */
  static calculateCost(model: string, usage: DeepSeekUsage): Omit<TokenRecord, 'id' | 'timestamp' | 'model' | 'hasToolCalls' | 'toolCallsCount' | 'messageId' | 'purpose'> {
    const norm = model.toLowerCase();
    const rates = MODEL_PRICING[norm] || MODEL_PRICING['deepseek-chat'];

    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;

    // Cache hit resolution
    const cacheHitTokens = usage.prompt_cache_hit_tokens ?? usage.prompt_tokens_details?.cached_tokens ?? 0;
    const cacheMissTokens = Math.max(0, promptTokens - cacheHitTokens);
    const totalTokens = promptTokens + completionTokens;

    const costHit = (cacheHitTokens / 1_000_000) * rates.cacheHitPerMillion;
    const costMiss = (cacheMissTokens / 1_000_000) * rates.cacheMissPerMillion;
    const costOut = (completionTokens / 1_000_000) * rates.outputPerMillion;

    const costUsd = Number((costHit + costMiss + costOut).toFixed(8));
    const costBrl = CurrencyService.convertUsdToBrl(costUsd);

    return {
      promptTokens,
      cacheHitTokens,
      cacheMissTokens,
      completionTokens,
      totalTokens,
      rateHitPerMillion: rates.cacheHitPerMillion,
      rateMissPerMillion: rates.cacheMissPerMillion,
      rateOutPerMillion: rates.outputPerMillion,
      costUsd,
      costBrl,
    };
  }

  /**
   * Initializes SQLite token database if not already present.
   */
  private static initSqlite(dbPath: string): Database | null {
    try {
      const db = new Database(dbPath);
      db.run(`
        CREATE TABLE IF NOT EXISTS token_ledger (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          model TEXT NOT NULL,
          message_id TEXT,
          purpose TEXT,
          prompt_tokens INTEGER NOT NULL,
          cache_hit_tokens INTEGER NOT NULL,
          cache_miss_tokens INTEGER NOT NULL,
          completion_tokens INTEGER NOT NULL,
          total_tokens INTEGER NOT NULL,
          rate_hit_per_million REAL NOT NULL,
          rate_miss_per_million REAL NOT NULL,
          rate_out_per_million REAL NOT NULL,
          cost_usd REAL NOT NULL,
          cost_brl REAL NOT NULL,
          has_tool_calls INTEGER NOT NULL,
          tool_calls_count INTEGER NOT NULL,
          latency_ms INTEGER,
          preview TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_token_ledger_ts ON token_ledger(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_token_ledger_msg ON token_ledger(message_id);
      `);

      // Migration for existing tables
      try {
        db.run('ALTER TABLE token_ledger ADD COLUMN message_id TEXT;');
      } catch {}
      try {
        db.run('ALTER TABLE token_ledger ADD COLUMN purpose TEXT;');
      } catch {}

      return db;
    } catch {
      return null;
    }
  }

  /**
   * Records exact API usage to persistent log and SQLite database.
   */
  static record(
    cwd: string,
    model: string,
    usage: DeepSeekUsage,
    meta: {
      toolCallsCount?: number;
      latencyMs?: number;
      preview?: string;
      messageId?: string;
      purpose?: string;
    } = {}
  ): TokenRecord {
    const costData = this.calculateCost(model, usage);
    const record: TokenRecord = {
      id: `tok-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      model,
      messageId: meta.messageId,
      purpose: meta.purpose,
      ...costData,
      hasToolCalls: (meta.toolCallsCount || 0) > 0,
      toolCallsCount: meta.toolCallsCount || 0,
      latencyMs: meta.latencyMs,
      preview: meta.preview?.slice(0, 150),
    };

    // 1. Write to JSONL
    try {
      const candidates = [
        path.join(cwd, 'logs'),
        '/workspace/group/logs',
        '/workspace/agent/logs',
        ...(process.env.AGENT_GROUP_DIR ? [path.join(process.env.AGENT_GROUP_DIR, 'logs')] : []),
      ];
      for (const logDir of candidates) {
        if (fs.existsSync(logDir)) {
          const jsonlPath = path.join(logDir, 'token_ledger.jsonl');
          fs.appendFileSync(jsonlPath, JSON.stringify(record) + '\n');
          break;
        }
      }
    } catch {}

    // 2. Write to SQLite
    try {
      const dbDir = path.join(cwd, 'logs');
      if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
      const dbPath = path.join(dbDir, 'token_ledger.db');
      const db = this.initSqlite(dbPath);
      if (db) {
        db.run(
          `
          INSERT INTO token_ledger (
            id, timestamp, model, message_id, purpose, prompt_tokens, cache_hit_tokens,
            cache_miss_tokens, completion_tokens, total_tokens,
            rate_hit_per_million, rate_miss_per_million, rate_out_per_million,
            cost_usd, cost_brl, has_tool_calls, tool_calls_count, latency_ms, preview
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            record.id,
            record.timestamp,
            record.model,
            record.messageId || null,
            record.purpose || null,
            record.promptTokens,
            record.cacheHitTokens,
            record.cacheMissTokens,
            record.completionTokens,
            record.totalTokens,
            record.rateHitPerMillion,
            record.rateMissPerMillion,
            record.rateOutPerMillion,
            record.costUsd,
            record.costBrl,
            record.hasToolCalls ? 1 : 0,
            record.toolCallsCount,
            record.latencyMs || null,
            record.preview || null,
          ]
        );
        db.close();
      }
    } catch {}

    return record;
  }
}
