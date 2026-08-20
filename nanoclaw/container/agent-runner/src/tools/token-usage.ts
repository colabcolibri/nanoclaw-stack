import fs from 'fs';
import path from 'path';
import { Database } from 'bun:sqlite';
import type { AgentTool } from './types.js';

export const tokenUsageTool: AgentTool = {
  domain: 'core_system',
  definition: {
    type: 'function',
    function: {
      name: 'token_usage',
      description: 'Consulta o extrato e histórico de consumo de tokens e custos em Reais (BRL) e Dólares (USD).',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['get_summary', 'get_recent_logs'],
            description: 'Ação: "get_summary" (totais e métricas agrupadas), "get_recent_logs" (detalhe das últimas chamadas).',
          },
          period: {
            type: 'string',
            enum: ['today', 'yesterday', '7d', '30d', 'all'],
            description: 'Período de consulta (padrão: "today").',
          },
          limit: {
            type: 'number',
            description: 'Quantidade de registros para get_recent_logs (padrão 10, max 50).',
          },
        },
        required: ['action'],
      },
    },
  },
  execute: async (args: any, cwd: string): Promise<string> => {
    try {
      const candidates = [
        path.join(cwd, 'logs', 'token_usage.db'),
        '/workspace/agent/logs/token_usage.db',
        '/opt/nanoclaw-stack/nanoclaw/groups/barao/logs/token_usage.db',
      ];

      let dbPath: string | null = null;
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          dbPath = c;
          break;
        }
      }

      if (!dbPath) {
        return JSON.stringify({
          status: 'ok',
          message: 'Nenhum registro de consumo encontrado ainda.',
          summary: { totalTokens: 0, costBrl: 'R$ 0,00', costUsd: '$ 0.00' },
        });
      }

      const db = new Database(dbPath, { readonly: true });
      const action = args.action || 'get_summary';
      const period = args.period || 'today';

      let timeFilter = '';
      const now = new Date();
      if (period === 'today') {
        const todayIso = now.toISOString().slice(0, 10);
        timeFilter = `WHERE timestamp >= '${todayIso}T00:00:00.000Z'`;
      } else if (period === 'yesterday') {
        const y = new Date(now.getTime() - 86400000);
        const yIso = y.toISOString().slice(0, 10);
        const tIso = now.toISOString().slice(0, 10);
        timeFilter = `WHERE timestamp >= '${yIso}T00:00:00.000Z' AND timestamp < '${tIso}T00:00:00.000Z'`;
      } else if (period === '7d') {
        const d7 = new Date(now.getTime() - 7 * 86400000);
        timeFilter = `WHERE timestamp >= '${d7.toISOString()}'`;
      } else if (period === '30d') {
        const d30 = new Date(now.getTime() - 30 * 86400000);
        timeFilter = `WHERE timestamp >= '${d30.toISOString()}'`;
      }

      if (action === 'get_recent_logs') {
        const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 50);
        const rows = db
          .query(`SELECT id, timestamp, model, prompt_tokens, completion_tokens, total_tokens, cost_brl, cost_usd, latency_ms FROM token_ledger ${timeFilter} ORDER BY rowid DESC LIMIT ?`)
          .all(limit) as any[];

        return JSON.stringify({
          status: 'ok',
          period,
          count: rows.length,
          logs: rows.map((r) => ({
            timestamp: r.timestamp,
            model: r.model,
            promptTokens: r.prompt_tokens,
            completionTokens: r.completion_tokens,
            totalTokens: r.total_tokens,
            costBrl: `R$ ${Number(r.cost_brl || 0).toFixed(4)}`,
            costUsd: `$ ${Number(r.cost_usd || 0).toFixed(4)}`,
            latencyMs: r.latency_ms,
          })),
        });
      }

      // get_summary
      const summaryRow = db
        .query(`SELECT 
            COUNT(*) as totalCalls,
            SUM(prompt_tokens) as totalPromptTokens,
            SUM(completion_tokens) as totalCompletionTokens,
            SUM(total_tokens) as totalTokens,
            SUM(cost_usd) as totalCostUsd,
            SUM(cost_brl) as totalCostBrl
          FROM token_ledger ${timeFilter}`)
        .get() as any;

      const modelRows = db
        .query(`SELECT 
            model,
            COUNT(*) as calls,
            SUM(total_tokens) as tokens,
            SUM(cost_brl) as costBrl,
            SUM(cost_usd) as costUsd
          FROM token_ledger ${timeFilter}
          GROUP BY model ORDER BY tokens DESC`)
        .all() as any[];

      return JSON.stringify({
        status: 'ok',
        period,
        totalCalls: summaryRow?.totalCalls || 0,
        totalPromptTokens: summaryRow?.totalPromptTokens || 0,
        totalCompletionTokens: summaryRow?.totalCompletionTokens || 0,
        totalTokens: summaryRow?.totalTokens || 0,
        totalCostBrl: `R$ ${(summaryRow?.totalCostBrl || 0).toFixed(4)}`,
        totalCostUsd: `$ ${(summaryRow?.totalCostUsd || 0).toFixed(4)}`,
        byModel: modelRows.map((m) => ({
          model: m.model,
          calls: m.calls,
          tokens: m.tokens,
          costBrl: `R$ ${(m.costBrl || 0).toFixed(4)}`,
          costUsd: `$ ${(m.costUsd || 0).toFixed(4)}`,
        })),
      });
    } catch (err: any) {
      return JSON.stringify({ status: 'error', error: err.message || String(err) });
    }
  },
};
