import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import glob from "fast-glob";
import { CONFIG } from "../config.js";
import { CurrencyService } from "./currency.js";

export interface ChatMessageItem {
  id: string;
  seq?: number;
  type: "user" | "assistant";
  timestamp: string;
  channel: string;
  senderName: string;
  text: string;
  rawJson?: any;
  threadId?: string;
  charCount?: number;
  tokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  cacheHitTokens?: number;
  cacheMissTokens?: number;
  cacheHitRatio?: string;
  costUsd?: number;
  costBrl?: number;
  subRuns?: IntermediateRunItem[];
}

export interface IntermediateRunItem {
  id: string;
  messageId: string;
  sessionId: string;
  type: string;
  timestamp: string;
  tokens: number;
  charCount: number;
  costUsd: number;
  costBrl: number;
  systemPrompt?: string;
  userPrompt?: string;
  toolName?: string;
  toolArgs?: any;
  toolResult?: any;
  rawContent: string;
  preview: string;
}

export interface SecurityOverview {
  users: { id: string; type: string; name: string | null; createdAt: string }[];
  pendingApprovals: { id: string; type: string; payload: string; createdAt: string }[];
  unregisteredSenders: { id: string; channel: string; senderId: string; createdAt: string }[];
  sessions: { id: string; agentGroupId: string; createdAt: string; lastActiveAt: string }[];
}

export class DatabaseService {
  static updateContainerConfig(agentGroupId: string, config: any) {
    if (!fs.existsSync(CONFIG.DB_PATH)) return;
    const db = new Database(CONFIG.DB_PATH);
    try {
      const mcpJson = JSON.stringify(config.mcpServers || {});
      const skillsJson = typeof config.skills === "string" ? `"${config.skills}"` : JSON.stringify(config.skills || "all");
      const provider = config.provider || "deepseek";
      const model = config.model || "deepseek-v4-flash";
      const assistantName = config.assistantName || config.groupName || "Barão";
      const now = new Date().toISOString();

      db.query(`
        UPDATE container_configs 
        SET provider = ?, model = ?, assistant_name = ?, skills = ?, mcp_servers = ?, updated_at = ?
        WHERE agent_group_id = ?
      `).run(provider, model, assistantName, skillsJson, mcpJson, now, agentGroupId);
    } catch (err) {
      console.error("Error updating container_configs in DB:", err);
    } finally {
      db.close();
    }
  }

  static listAgentGroups(): any[] {
    if (!fs.existsSync(CONFIG.DB_PATH)) return [];
    const db = new Database(CONFIG.DB_PATH, { readonly: true });
    try {
      return db.query("SELECT * FROM agent_groups").all();
    } catch {
      return [];
    } finally {
      db.close();
    }
  }

  static getSecurityData(): SecurityOverview {
    const result: SecurityOverview = {
      users: [],
      pendingApprovals: [],
      unregisteredSenders: [],
      sessions: [],
    };

    if (!fs.existsSync(CONFIG.DB_PATH)) return result;
    const db = new Database(CONFIG.DB_PATH, { readonly: true });
    try {
      try {
        result.users = (db.query("SELECT id, type, name, created_at as createdAt FROM users ORDER BY created_at DESC").all() as any[]) || [];
      } catch {}
      try {
        result.pendingApprovals = (db.query("SELECT * FROM pending_approvals ORDER BY created_at DESC").all() as any[]) || [];
      } catch {}
      try {
        result.unregisteredSenders = (db.query("SELECT * FROM unregistered_senders ORDER BY created_at DESC").all() as any[]) || [];
      } catch {}
      try {
        result.sessions = (db.query("SELECT id, agent_group_id as agentGroupId, created_at as createdAt, updated_at as lastActiveAt FROM sessions ORDER BY updated_at DESC").all() as any[]) || [];
      } catch {}
    } catch {} finally {
      db.close();
    }

    return result;
  }

  static getRealTokenRecords(limit = 200): any[] {
    const recordMap = new Map<string, any>();
    const searchDirs = [
      path.join(CONFIG.GROUPS_PATH),
      path.join(CONFIG.DATA_PATH, "v2-sessions"),
    ];

    for (const baseDir of searchDirs) {
      if (!fs.existsSync(baseDir)) continue;
      const ledgerFiles = glob.sync(`${baseDir}/**/token_ledger.jsonl`);
      for (const file of ledgerFiles) {
        try {
          const content = fs.readFileSync(file, "utf-8");
          const lines = content.split("\n").filter((l) => l.trim().length > 0);
          for (const line of lines) {
            try {
              const rec = JSON.parse(line);
              if (rec && rec.id) {
                recordMap.set(rec.id, rec);
              }
            } catch {}
          }
        } catch {}
      }
    }

    const records = Array.from(recordMap.values());
    records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return records.slice(0, limit);
  }

  static getSystemStats(): any {
    let totalSessions = 0;
    let totalUsers = 0;
    let activeGroups = 0;

    if (fs.existsSync(CONFIG.DB_PATH)) {
      const db = new Database(CONFIG.DB_PATH, { readonly: true });
      try {
        totalSessions = (db.query("SELECT count(*) as count FROM sessions").get() as any)?.count || 0;
        totalUsers = (db.query("SELECT count(*) as count FROM users").get() as any)?.count || 0;
        activeGroups = (db.query("SELECT count(*) as count FROM agent_groups").get() as any)?.count || 0;
      } catch {} finally {
        db.close();
      }
    }

    const messages = this.getUsageLogs(1000);
    const runs = this.getDetailedRuns(1000);
    const realLedger = this.getRealTokenRecords(1000);

    const totalInbound = messages.filter((m) => m.type === "user").length;
    const totalOutbound = messages.filter((m) => m.type === "assistant").length;

    // Real API Token Metrics from DeepSeek
    let totalPromptTokens = 0;
    let totalCacheHitTokens = 0;
    let totalCacheMissTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    let totalCostUsd = 0;

    if (realLedger.length > 0) {
      for (const rec of realLedger) {
        totalPromptTokens += Number(rec.promptTokens || 0);
        totalCacheHitTokens += Number(rec.cacheHitTokens || 0);
        totalCacheMissTokens += Number(rec.cacheMissTokens || 0);
        totalCompletionTokens += Number(rec.completionTokens || 0);
        totalTokens += Number(rec.totalTokens || 0);
        totalCostUsd += Number(rec.costUsd || 0);
      }
    } else {
      // Fallback to chat messages tokens if ledger is fresh
      totalTokens = messages.reduce((acc, m) => acc + (m.tokens || 0), 0);
      totalCostUsd = (totalTokens / 1_000_000) * 0.44;
    }

    const usdToBrlRate = CurrencyService.getRateSync();
    const totalCostBrl = CurrencyService.convertUsdToBrl(totalCostUsd);
    const cacheHitRatio = totalPromptTokens > 0 ? Math.round((totalCacheHitTokens / totalPromptTokens) * 100) : 0;

    return {
      totalSessions,
      totalUsers,
      activeGroups,
      totalMessages: messages.length,
      totalRuns: runs.length,
      totalApiCalls: realLedger.length,
      totalInbound,
      totalOutbound,
      promptTokens: totalPromptTokens,
      cacheHitTokens: totalCacheHitTokens,
      cacheMissTokens: totalCacheMissTokens,
      completionTokens: totalCompletionTokens,
      cacheHitRatio: `${cacheHitRatio}%`,
      estimatedTokens: totalTokens,
      totalTokens,
      usdToBrlRate,
      estimatedCostUsd: totalCostUsd.toFixed(5),
      estimatedCostBrl: totalCostBrl.toFixed(4),
      modelName: "DeepSeek V4 Flash (Peak Pricing: $0.014 hit / $0.44 miss / $1.32 out)",
    };
  }

  static parseMessageContent(raw: string, fallbackType: "user" | "assistant"): { text: string; senderName: string; threadId?: string } {
    if (!raw) return { text: "", senderName: fallbackType === "user" ? "Usuário" : "Barão" };
    try {
      if (raw.trim().startsWith("{") || raw.trim().startsWith("[")) {
        const parsed = JSON.parse(raw);
        const text = parsed.text || parsed.content || parsed.message || (typeof parsed === "string" ? parsed : JSON.stringify(parsed));
        const senderName = parsed.author?.senderName || parsed.senderName || parsed.sender || (fallbackType === "user" ? "Usuário" : "Barão");
        const threadId = parsed.threadId || parsed.channelId;
        return { text, senderName, threadId };
      }
    } catch {}
    return { text: raw, senderName: fallbackType === "user" ? "Usuário" : "Barão" };
  }

  static getChatMessages(limit = 100): ChatMessageItem[] {
    const messages = this.getUsageLogs(limit);
    messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return messages.slice(-limit);
  }

  static getUsageLogs(limit = 200): ChatMessageItem[] {
    const messages: ChatMessageItem[] = [];
    const sessionDir = path.join(CONFIG.DATA_PATH, "v2-sessions");
    if (!fs.existsSync(sessionDir)) return messages;

    try {
      const inbounds = glob.sync(`${sessionDir}/**/inbound.db`);
      const outbounds = glob.sync(`${sessionDir}/**/outbound.db`);

      for (const inDbPath of inbounds) {
        try {
          const db = new Database(inDbPath, { readonly: true });
          const rows = db.query("SELECT * FROM messages_in ORDER BY timestamp DESC LIMIT ?").all(limit) as any[];
          for (const r of rows) {
            const parsed = this.parseMessageContent(r.content || "", "user");
            const charCount = parsed.text.length;
            const tokens = Math.max(1, Math.round(charCount / 3.5));
            const costUsd = (tokens / 1_000_000) * 0.14;
            const costBrl = costUsd * 5.7;

            messages.push({
              id: r.id,
              seq: r.seq,
              type: "user",
              timestamp: r.timestamp || new Date().toISOString(),
              channel: r.channel_type || "telegram",
              senderName: parsed.senderName,
              text: parsed.text,
              threadId: parsed.threadId || r.thread_id,
              charCount,
              tokens,
              costUsd,
              costBrl,
            });
          }
          db.close();
        } catch {}
      }

      const allSubRuns = this.getDetailedRuns(500);

      for (const outDbPath of outbounds) {
        try {
          const db = new Database(outDbPath, { readonly: true });
          const rows = db.query("SELECT * FROM messages_out ORDER BY timestamp DESC LIMIT ?").all(limit) as any[];
          for (const r of rows) {
            const parsed = this.parseMessageContent(r.content || "", "assistant");
            const charCount = parsed.text.length;

            // Associate subRuns
            const msgTime = new Date(r.timestamp || new Date()).getTime();
            const matchedRuns = allSubRuns.filter((run) => {
              const runTime = new Date(run.timestamp).getTime();
              return Math.abs(msgTime - runTime) <= 60000; // within 1 minute window of the turn
            });

            let promptTokens = 0;
            let completionTokens = 0;
            let cacheHitTokens = 0;
            let cacheMissTokens = 0;
            let totalTokens = Math.max(1, Math.round(charCount / 3.5));
            let costUsd = (totalTokens / 1_000_000) * 0.44;
            let costBrl = CurrencyService.convertUsdToBrl(costUsd);

            if (matchedRuns.length > 0) {
              promptTokens = matchedRuns.reduce((acc, run) => acc + (run.promptTokens || 0), 0);
              completionTokens = matchedRuns.reduce((acc, run) => acc + (run.completionTokens || 0), 0);
              cacheHitTokens = matchedRuns.reduce((acc, run) => acc + (run.cacheHitTokens || 0), 0);
              cacheMissTokens = matchedRuns.reduce((acc, run) => acc + (run.cacheMissTokens || 0), 0);
              totalTokens = promptTokens + completionTokens;
              costUsd = matchedRuns.reduce((acc, run) => acc + (run.costUsd || 0), 0);
              costBrl = CurrencyService.convertUsdToBrl(costUsd);
            }

            const cacheHitRatio = promptTokens > 0 ? `${Math.round((cacheHitTokens / promptTokens) * 100)}%` : "0%";

            messages.push({
              id: r.id,
              seq: r.seq,
              type: "assistant",
              timestamp: r.timestamp || new Date().toISOString(),
              channel: r.channel_type || "telegram",
              senderName: "Barão",
              text: parsed.text,
              threadId: r.thread_id,
              charCount,
              tokens: totalTokens,
              promptTokens,
              completionTokens,
              cacheHitTokens,
              cacheMissTokens,
              cacheHitRatio,
              costUsd,
              costBrl,
              subRuns: matchedRuns.length > 0 ? matchedRuns : undefined,
            });
          }
          db.close();
        } catch {}
      }
    } catch {}

    messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return messages.slice(0, limit);
  }

  static getDetailedRuns(limit = 100): IntermediateRunItem[] {
    const runs: IntermediateRunItem[] = [];
    const ledgerRecords = this.getRealTokenRecords(limit);

    for (const rec of ledgerRecords) {
      const isTool = rec.hasToolCalls || (rec.toolCallsCount && rec.toolCallsCount > 0);
      let toolName = "";
      if (rec.preview && rec.preview.startsWith("Tool: ")) {
        toolName = rec.preview.replace("Tool: ", "").trim();
      }

      runs.push({
        id: rec.id,
        messageId: rec.id,
        sessionId: rec.sessionId,
        type: isTool ? "tool_execution" : "model_turn",
        timestamp: rec.timestamp,
        charCount: rec.totalTokens * 4,
        tokens: rec.totalTokens,
        promptTokens: rec.promptTokens,
        cacheHitTokens: rec.cacheHitTokens,
        cacheMissTokens: rec.cacheMissTokens,
        completionTokens: rec.completionTokens,
        costUsd: rec.costUsd,
        costBrl: rec.costBrl,
        latencyMs: rec.latencyMs,
        toolName: toolName || (isTool ? "Ferramenta" : undefined),
        rawContent: rec.preview || "",
        preview: rec.preview || (isTool ? `Execução de ${rec.toolCallsCount} ferramenta(s)` : "Resposta do modelo"),
      });
    }

    return runs.slice(0, limit);
  }

  static getScheduledTasks(folder = "barao") {
    const sessionsRoot = path.join(CONFIG.NANOCLAW_PATH, "data", "v2-sessions");
    const tasks: any[] = [];
    if (!fs.existsSync(sessionsRoot)) return tasks;

    try {
      const groups = fs.readdirSync(sessionsRoot);
      for (const g of groups) {
        const gPath = path.join(sessionsRoot, g);
        const sessions = fs.readdirSync(gPath).filter((s) => s.startsWith("sess-1"));
        for (const s of sessions) {
          const dbPath = path.join(gPath, s, "inbound.db");
          if (fs.existsSync(dbPath)) {
            try {
              const inDb = new Database(dbPath);
              const rows = inDb
                .query(
                  `SELECT id, kind, timestamp, status, process_after, recurrence, trigger, channel_type, platform_id, content 
                   FROM messages_in 
                   WHERE (process_after IS NOT NULL OR recurrence IS NOT NULL) AND status = 'pending'
                   ORDER BY timestamp DESC`
                )
                .all() as any[];

              for (const r of rows) {
                let text = "";
                let isRecurring = Boolean(r.recurrence);
                let cron = r.recurrence || null;
                try {
                  const parsed = JSON.parse(r.content);
                  text = parsed.text || "";
                } catch {}

                tasks.push({
                  id: r.id,
                  kind: r.kind,
                  status: r.status,
                  createdAt: r.timestamp,
                  processAfter: r.process_after,
                  recurrence: cron,
                  isRecurring,
                  channelType: r.channel_type || "telegram",
                  platformId: r.platform_id,
                  prompt: text,
                  dbPath,
                });
              }
              inDb.close();
            } catch {}
          }
        }
      }
    } catch {}

    return tasks;
  }

  static cancelScheduledTask(taskId: string) {
    const sessionsRoot = path.join(CONFIG.NANOCLAW_PATH, "data", "v2-sessions");
    if (!fs.existsSync(sessionsRoot)) return false;

    try {
      const groups = fs.readdirSync(sessionsRoot);
      for (const g of groups) {
        const gPath = path.join(sessionsRoot, g);
        const sessions = fs.readdirSync(gPath).filter((s) => s.startsWith("sess-1"));
        for (const s of sessions) {
          const dbPath = path.join(gPath, s, "inbound.db");
          if (fs.existsSync(dbPath)) {
            try {
              const inDb = new Database(dbPath);
              inDb.query("DELETE FROM messages_in WHERE id = ?").run(taskId);
              inDb.close();
            } catch {}
          }
        }
      }
      return true;
    } catch {
      return false;
    }
  }
}
