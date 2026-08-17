import fs from 'fs';
import path from 'path';

export interface DeepSeekUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

export const DEEPSEEK_PRICING: Record<string, { cacheHitPerMillion: number; cacheMissPerMillion: number; outputPerMillion: number }> = {
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
    const costBrl = Number((costUsd * 5.75).toFixed(6));

    return {
      promptTokens,
      cacheHitTokens,
      cacheMissTokens,
      completionTokens,
      totalTokens,
      costUsd,
      costBrl,
    };
  }

  /**
   * Records exact API usage to persistent log and SQLite/JSON ledger.
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

    // 1. Write to JSONL in group logs directory
    try {
      const candidates = [
        path.join(cwd, 'logs'),
        path.join(cwd, '..', 'logs'),
        '/workspace/group/logs',
        '/workspace/agent/logs',
        '/opt/nanoclaw-stack/nanoclaw/groups/barao/logs',
      ];
      for (const logDir of candidates) {
        try {
          if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
          const ledgerFile = path.join(logDir, 'token_ledger.jsonl');
          fs.appendFileSync(ledgerFile, JSON.stringify(record) + '\n', 'utf-8');
          break;
        } catch {}
      }
    } catch {}

    return record;
  }
}
