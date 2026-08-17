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

export const DEEPSEEK_PRICING: Record<
  string,
  { cacheHitPerMillion: number; cacheMissPerMillion: number; outputPerMillion: number }
> = {
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

export interface TokenRecord {
  id: string;
  timestamp: string;
  model: string;
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
  static calculateCost(model: string, usage: DeepSeekUsage): {
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
  } {
    const key = model.toLowerCase().trim();
    const rates = DEEPSEEK_PRICING[key] || DEEPSEEK_PRICING['deepseek-v4-flash'];

    const promptTokens = Number(usage.prompt_tokens || 0);
    const cacheHitTokens = Number(usage.prompt_cache_hit_tokens ?? usage.prompt_tokens_details?.cached_tokens ?? 0);
    const cacheMissTokens = Math.max(0, promptTokens - cacheHitTokens);
    const completionTokens = Number(usage.completion_tokens || 0);
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
      `);
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
    } = {}
  ): TokenRecord {
    const costData = this.calculateCost(model, usage);
    const record: TokenRecord = {
      id: `tok-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      model,
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
        try {
          if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
          const ledgerFile = path.join(logDir, 'token_ledger.jsonl');
          fs.appendFileSync(ledgerFile, JSON.stringify(record) + '\n', 'utf-8');

          // 2. Write to SQLite database
          const dbPath = path.join(logDir, 'token_usage.db');
          const db = this.initSqlite(dbPath);
          if (db) {
            db.query(`
              INSERT OR REPLACE INTO token_ledger (
                id, timestamp, model, prompt_tokens, cache_hit_tokens, cache_miss_tokens,
                completion_tokens, total_tokens, rate_hit_per_million, rate_miss_per_million,
                rate_out_per_million, cost_usd, cost_brl, has_tool_calls, tool_calls_count,
                latency_ms, preview
              ) VALUES (
                $id, $timestamp, $model, $prompt_tokens, $cache_hit_tokens, $cache_miss_tokens,
                $completion_tokens, $total_tokens, $rate_hit_per_million, $rate_miss_per_million,
                $rate_out_per_million, $cost_usd, $cost_brl, $has_tool_calls, $tool_calls_count,
                $latency_ms, $preview
              )
            `).run({
              $id: record.id,
              $timestamp: record.timestamp,
              $model: record.model,
              $prompt_tokens: record.promptTokens,
              $cache_hit_tokens: record.cacheHitTokens,
              $cache_miss_tokens: record.cacheMissTokens,
              $completion_tokens: record.completionTokens,
              $total_tokens: record.totalTokens,
              $rate_hit_per_million: record.rateHitPerMillion,
              $rate_miss_per_million: record.rateMissPerMillion,
              $rate_out_per_million: record.rateOutPerMillion,
              $cost_usd: record.costUsd,
              $cost_brl: record.costBrl,
              $has_tool_calls: record.hasToolCalls ? 1 : 0,
              $tool_calls_count: record.toolCallsCount,
              $latency_ms: record.latencyMs ?? null,
              $preview: record.preview ?? null,
            });
            db.close();
          }
          break;
        } catch {}
      }
    } catch {}

    return record;
  }
}
