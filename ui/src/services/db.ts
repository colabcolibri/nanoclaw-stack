import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import glob from "fast-glob";
import { CONFIG } from "../config.js";
import { CurrencyService } from "./currency.js";
import {
  formatPurposeLabel,
  getPurposeMeta,
  parseToolNameFromPreview,
  resolvePurpose,
} from "../../../nanoclaw/container/agent-runner/src/services/llm-call-purpose.js";
import {
  cancelScheduledTask as cancelOfficialTask,
  getTaskExecutionLogs,
  getTaskExecutionLogsWithTotal,
  listScheduledTasks,
  pauseScheduledTask as pauseOfficialTask,
  resumeScheduledTask as resumeOfficialTask,
  updateScheduledTask as updateOfficialTask,
} from "./scheduled-tasks.js";

export interface ChatMessageItem {
  id: string;
  seq?: number;
  type: "user" | "assistant";
  timestamp: string;
  channel: string;
  senderName: string;
  text: string;
  model?: string;
  rawJson?: any;
  threadId?: string;
  sessionId?: string;
  agentGroupId?: string;
  charCount?: number;
  tokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  cacheHitTokens?: number;
  cacheMissTokens?: number;
  cacheHitRatio?: string;
  costInUsd?: number;
  costInBrl?: number;
  costOutUsd?: number;
  costOutBrl?: number;
  costUsd?: number;
  costBrl?: number;
  memo?: string | null;
  subRuns?: IntermediateRunItem[];
}

export interface ChatThreadItem {
  sessionId: string;
  agentGroupId: string;
  threadId: string | null;
  channel: string;
  status: "active" | "archived" | "closed";
  conversationId: string | null;
  lastActiveAt: string | null;
  messageCount: number;
  lastPreview: string;
  lastSenderName: string;
}

export interface IntermediateRunItem {
  id: string;
  messageId: string;
  sessionId: string;
  type: string;
  timestamp: string;
  model?: string;
  tokens: number;
  charCount: number;
  promptTokens?: number;
  completionTokens?: number;
  cacheHitTokens?: number;
  cacheMissTokens?: number;
  costInUsd?: number;
  costOutUsd?: number;
  costUsd: number;
  costBrl: number;
  latencyMs?: number;
  systemPrompt?: string;
  userPrompt?: string;
  toolName?: string;
  toolArgs?: any;
  toolResult?: any;
  rawContent: string;
  preview: string;
  purpose?: string;
  label?: string;
  shortLabel?: string;
}

import {
  parseAgentAuditJsonl,
  type AgentAuditTraceItem,
} from "./audit-traces.js";

export type { AgentAuditTraceItem };

export interface SecurityOverview {
  users: { id: string; type: string; name: string | null; createdAt: string }[];
  pendingApprovals: { id: string; type: string; payload: string; createdAt: string }[];
  unregisteredSenders: { id: string; channel: string; senderId: string; createdAt: string }[];
  sessions: { id: string; agentGroupId: string; createdAt: string; lastActiveAt: string }[];
}

export interface ConnectedChannelItem {
  id: string;
  channelType: string;
  platformId: string;
  instance: string;
  name: string | null;
  isGroup: boolean;
  unknownSenderPolicy: string;
  createdAt: string;
  deniedAt: string | null;
  agentGroupId: string | null;
  agentGroupName: string | null;
  agentFolder: string | null;
  engageMode: string | null;
}

export class DatabaseService {
  private static resolveGroupFolderByAgentGroupId(agentGroupId: string): string | null {
    if (!fs.existsSync(CONFIG.DB_PATH)) return null;
    const db = new Database(CONFIG.DB_PATH, { readonly: true });
    try {
      const row = db
        .query("SELECT folder FROM agent_groups WHERE id = ?")
        .get(agentGroupId) as { folder?: string } | undefined;
      const folder = row?.folder?.trim();
      return folder || null;
    } catch {
      return null;
    } finally {
      db.close();
    }
  }

  static getContainerConfigByFolder(folder: string): Record<string, any> | null {
    if (!fs.existsSync(CONFIG.DB_PATH)) return null;
    const db = new Database(CONFIG.DB_PATH, { readonly: true });
    try {
      const group = db
        .query("SELECT id FROM agent_groups WHERE folder = ?")
        .get(path.basename(folder)) as { id?: string } | undefined;
      if (!group?.id) return null;
      const row = db
        .query("SELECT * FROM container_configs WHERE agent_group_id = ?")
        .get(group.id) as Record<string, any> | undefined;
      return row ?? null;
    } catch {
      return null;
    } finally {
      db.close();
    }
  }

  static updateContainerConfig(agentGroupId: string, config: any) {
    this.updateContainerConfigFields(agentGroupId, config, { syncContainerJson: true });
  }

  /** Atualiza container_configs; opcionalmente sincroniza container.json (use false quando o caller já gravou modelos efetivos). */
  static updateContainerConfigFields(
    agentGroupId: string,
    config: any,
    opts?: { syncContainerJson?: boolean },
  ) {
    if (!fs.existsSync(CONFIG.DB_PATH)) return;
    const db = new Database(CONFIG.DB_PATH);
    try {
      const mcpJson = JSON.stringify(config.mcpServers || {});
      const skillsJson = typeof config.skills === "string" ? `"${config.skills}"` : JSON.stringify(config.skills || "all");
      const provider = config.provider ?? null;
      const model = config.model ?? null;
      const assistantName = config.assistantName || config.groupName || config.name || "Barão";
      const timezone = config.timezone || "Europe/Brussels";
      const city = config.city || "";
      const country = config.country || config.location || "";
      const location = [city, country].filter(Boolean).join(", ") || "";
      const orchestratorModel = config.orchestratorModel || null;
      const senderModel = config.senderModel || null;
      const memoModel = config.memoModel || null;
      const roleInferenceParams = config.roleInferenceParams
        ? JSON.stringify(config.roleInferenceParams)
        : null;
      const now = new Date().toISOString();

      try {
        db.run("ALTER TABLE container_configs ADD COLUMN location TEXT;");
        db.run("ALTER TABLE container_configs ADD COLUMN city TEXT;");
        db.run("ALTER TABLE container_configs ADD COLUMN country TEXT;");
        db.run("ALTER TABLE container_configs ADD COLUMN orchestrator_model TEXT;");
        db.run("ALTER TABLE container_configs ADD COLUMN sender_model TEXT;");
        db.run("ALTER TABLE container_configs ADD COLUMN memo_model TEXT;");
        db.run("ALTER TABLE container_configs ADD COLUMN role_inference_params TEXT;");
      } catch {}

      db.query(`
        UPDATE container_configs 
        SET provider = ?, model = ?, assistant_name = ?, skills = ?, mcp_servers = ?, timezone = ?, location = ?,
            city = ?, country = ?, orchestrator_model = ?, sender_model = ?, memo_model = ?,
            role_inference_params = ?, updated_at = ?
        WHERE agent_group_id = ?
      `).run(
        provider,
        model,
        assistantName,
        skillsJson,
        mcpJson,
        timezone,
        location,
        city,
        country,
        orchestratorModel,
        senderModel,
        memoModel,
        roleInferenceParams,
        now,
        agentGroupId
      );

      // Also sync to container.json for container runtime access
      const groupFolder = this.resolveGroupFolderByAgentGroupId(agentGroupId);
      if (opts?.syncContainerJson !== false && groupFolder) {
        const groupContainer = path.join(CONFIG.GROUPS_PATH, groupFolder, "container.json");
        if (fs.existsSync(groupContainer)) {
          try {
            const current = JSON.parse(fs.readFileSync(groupContainer, "utf-8"));
            const updated = {
              ...current,
              provider,
              model,
              assistantName,
              timezone,
              orchestratorModel,
              senderModel,
              memoModel,
              roleInferenceParams: config.roleInferenceParams ?? {},
              city,
              country,
              location,
            };
            fs.writeFileSync(groupContainer, JSON.stringify(updated, null, 2), "utf-8");
          } catch {}
        }
      }
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
        result.users =
          (db
            .query(
              `SELECT id,
                      kind AS type,
                      display_name AS name,
                      created_at AS createdAt
               FROM users
               ORDER BY created_at DESC`,
            )
            .all() as any[]) || [];
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

  static getConnectedChannels(): ConnectedChannelItem[] {
    if (!fs.existsSync(CONFIG.DB_PATH)) return [];
    const db = new Database(CONFIG.DB_PATH, { readonly: true });
    try {
      const rows = db
        .query(
          `SELECT mg.id,
                  mg.channel_type AS channelType,
                  mg.platform_id AS platformId,
                  mg.instance,
                  mg.name,
                  mg.is_group AS isGroup,
                  mg.unknown_sender_policy AS unknownSenderPolicy,
                  mg.created_at AS createdAt,
                  mg.denied_at AS deniedAt,
                  ag.id AS agentGroupId,
                  ag.name AS agentGroupName,
                  ag.folder AS agentFolder,
                  mga.engage_mode AS engageMode
           FROM messaging_groups mg
           LEFT JOIN messaging_group_agents mga ON mga.messaging_group_id = mg.id
           LEFT JOIN agent_groups ag ON ag.id = mga.agent_group_id
           ORDER BY mg.created_at DESC`,
        )
        .all() as Array<{
          id: string;
          channelType: string;
          platformId: string;
          instance: string;
          name: string | null;
          isGroup: number;
          unknownSenderPolicy: string;
          createdAt: string;
          deniedAt: string | null;
          agentGroupId: string | null;
          agentGroupName: string | null;
          agentFolder: string | null;
          engageMode: string | null;
        }>;

      return rows.map((row) => ({
        id: row.id,
        channelType: row.channelType,
        platformId: row.platformId,
        instance: row.instance,
        name: row.name,
        isGroup: row.isGroup === 1,
        unknownSenderPolicy: row.unknownSenderPolicy,
        createdAt: row.createdAt,
        deniedAt: row.deniedAt,
        agentGroupId: row.agentGroupId,
        agentGroupName: row.agentGroupName,
        agentFolder: row.agentFolder,
        engageMode: row.engageMode,
      }));
    } catch {
      return [];
    } finally {
      db.close();
    }
  }

  static getRealTokenRecords(limit = 200): any[] {
    return this.getRealTokenRecordsWithTotal(limit).records;
  }

  static getRealTokenRecordsWithTotal(
    limit?: number,
    offset = 0,
  ): { records: any[]; total: number } {
    const recordMap = new Map<string, any>();
    const searchDirs = [
      path.join(CONFIG.GROUPS_PATH),
      path.join(CONFIG.DATA_PATH, "v2-sessions"),
    ];
    const dbDirs = new Set<string>();

    const upsertRecord = (rec: any) => {
      if (!rec?.id) return;
      const existing = recordMap.get(rec.id);
      const recBody = rec.content || rec.preview || "";
      const existingBody = existing?.content || existing?.preview || "";
      if (!existing || recBody.length >= existingBody.length) {
        recordMap.set(rec.id, rec);
      }
    };

    for (const baseDir of searchDirs) {
      if (!fs.existsSync(baseDir)) continue;

      const dbFiles = glob.sync(`${baseDir}/**/token_ledger.db`);
      for (const dbPath of dbFiles) {
        dbDirs.add(path.dirname(dbPath));
        try {
          const db = new Database(dbPath, { readonly: true });
          try {
            const sqlLimit = typeof limit === "number" ? limit + offset : undefined;
            const rows = (sqlLimit
              ? db
                  .query(
                    `SELECT id, timestamp, model, message_id, purpose, prompt_tokens, cache_hit_tokens,
                            cache_miss_tokens, completion_tokens, total_tokens, cost_usd, cost_brl,
                            has_tool_calls, tool_calls_count, latency_ms, preview, content
                     FROM token_ledger
                     ORDER BY timestamp DESC
                     LIMIT ?`,
                  )
                  .all(sqlLimit)
              : db
                  .query(
                    `SELECT id, timestamp, model, message_id, purpose, prompt_tokens, cache_hit_tokens,
                            cache_miss_tokens, completion_tokens, total_tokens, cost_usd, cost_brl,
                            has_tool_calls, tool_calls_count, latency_ms, preview, content
                     FROM token_ledger
                     ORDER BY timestamp DESC`,
                  )
                  .all()) as any[];
            for (const row of rows) {
              upsertRecord({
                id: row.id,
                timestamp: row.timestamp,
                model: row.model,
                messageId: row.message_id,
                purpose: row.purpose,
                promptTokens: row.prompt_tokens,
                cacheHitTokens: row.cache_hit_tokens,
                cacheMissTokens: row.cache_miss_tokens,
                completionTokens: row.completion_tokens,
                totalTokens: row.total_tokens,
                costUsd: row.cost_usd,
                costBrl: row.cost_brl,
                hasToolCalls: Boolean(row.has_tool_calls),
                toolCallsCount: row.tool_calls_count,
                latencyMs: row.latency_ms,
                preview: row.preview,
                content: row.content,
              });
            }
          } finally {
            db.close();
          }
        } catch {}
      }

      const ledgerFiles = glob.sync(`${baseDir}/**/token_ledger.jsonl`);
      for (const file of ledgerFiles) {
        if (dbDirs.has(path.dirname(file))) continue;
        try {
          const content = fs.readFileSync(file, "utf-8");
          const lines = content.split("\n").filter((line: string) => line.trim().length > 0);
          for (const line of lines) {
            try {
              upsertRecord(JSON.parse(line));
            } catch {}
          }
        } catch {}
      }
    }

    const records = Array.from(recordMap.values());
    records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const start = Math.max(0, offset);
    const end = typeof limit === "number" ? start + limit : undefined;
    return {
      records: records.slice(start, end),
      total: records.length,
    };
  }

  static getDefaultModel(): string {
    if (fs.existsSync(CONFIG.DB_PATH)) {
      const db = new Database(CONFIG.DB_PATH, { readonly: true });
      try {
        const row = db.query("SELECT model FROM container_configs WHERE model IS NOT NULL AND model != '' ORDER BY updated_at DESC LIMIT 1").get() as any;
        if (row?.model) return row.model;
      } catch {} finally {
        db.close();
      }
    }
    const defaultContainer = path.join(CONFIG.GROUPS_PATH, CONFIG.DEFAULT_GROUP_FOLDER, "container.json");
    if (fs.existsSync(defaultContainer)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(defaultContainer, "utf-8"));
        if (parsed.model) return parsed.model;
      } catch {}
    }
    return "";
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

    // Real API Token Metrics from DeepSeek / LLM Ledger
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

    const defaultModel = this.getDefaultModel();
    const distinctModels = Array.from(new Set(realLedger.map((r) => r.model).filter(Boolean)));
    const modelDisplay = distinctModels.length > 0 ? distinctModels.join(", ") : defaultModel;

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
      modelName: modelDisplay,
    };
  }

  static parseMessageContent(raw: string, fallbackType: "user" | "assistant"): { text: string; senderName: string; threadId?: string } {
    if (!raw) return { text: "", senderName: fallbackType === "user" ? "Usuário" : "Assistente" };
    try {
      if (raw.trim().startsWith("{") || raw.trim().startsWith("[")) {
        const parsed = JSON.parse(raw);
        const text = parsed.text || parsed.content || parsed.message || (typeof parsed === "string" ? parsed : JSON.stringify(parsed));
        const senderName = parsed.author?.senderName || parsed.senderName || parsed.sender || (fallbackType === "user" ? "Usuário" : "Assistente");
        const threadId = parsed.threadId || parsed.channelId;
        return {
          text: fallbackType === "assistant" ? this.stripDeliveryEnvelope(String(text)) : String(text),
          senderName,
          threadId,
        };
      }
    } catch {}
    const text = fallbackType === "assistant" ? this.stripDeliveryEnvelope(raw) : raw;
    return { text, senderName: fallbackType === "user" ? "Usuário" : "Assistente" };
  }

  /** Internal poll-loop envelope — not user-facing. */
  private static stripDeliveryEnvelope(raw: string): string {
    return raw
      .replace(/<message[^>]*>/gi, "")
      .replace(/<\/message>/gi, "")
      .trim();
  }

  static getChatMessages(limit = 100, sessionId?: string): ChatMessageItem[] {
    const messages = this.getUsageLogs(limit, sessionId ? { sessionId } : undefined);
    messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return messages.slice(-limit);
  }

  static getSessionById(sessionId: string): {
    id: string;
    agent_group_id: string;
    messaging_group_id: string | null;
    thread_id: string | null;
    conversation_id: string | null;
    agent_provider: string | null;
    status: string;
    container_status: string;
    last_active: string | null;
    archived_at: string | null;
    created_at: string;
  } | null {
    if (!sessionId || !fs.existsSync(CONFIG.DB_PATH)) return null;
    try {
      const db = new Database(CONFIG.DB_PATH, { readonly: true });
      const row = db
        .query(
          `SELECT id, agent_group_id, messaging_group_id, thread_id, conversation_id,
                  agent_provider, status, container_status, last_active, archived_at, created_at
           FROM sessions WHERE id = ?`,
        )
        .get(sessionId) as {
        id: string;
        agent_group_id: string;
        messaging_group_id: string | null;
        thread_id: string | null;
        conversation_id: string | null;
        agent_provider: string | null;
        status: string;
        container_status: string;
        last_active: string | null;
        archived_at: string | null;
        created_at: string;
      } | null;
      db.close();
      return row ?? null;
    } catch {
      return null;
    }
  }

  static getChatThreadsForGroup(agentGroupId: string, channel?: string, limit = 50): ChatThreadItem[] {
    const threads = this.getChatThreads(limit * 4);
    return this.dedupeActiveThreadsPerBinding(
      threads
        .filter((t) => t.agentGroupId === agentGroupId)
        .filter((t) => !channel || t.channel === channel),
    ).slice(0, limit);
  }

  /**
   * UI invariant: one open conversation per (group, channel, thread).
   * If the DB has stale duplicates, keep the newest active and treat the rest as archived in the list.
   */
  private static dedupeActiveThreadsPerBinding(threads: ChatThreadItem[]): ChatThreadItem[] {
    const activeWinner = new Map<string, string>();
    const sorted = [...threads].sort((a, b) => {
      const tA = Date.parse(a.lastActiveAt || "") || 0;
      const tB = Date.parse(b.lastActiveAt || "") || 0;
      return tB - tA;
    });

    for (const thread of sorted) {
      if (thread.status !== "active") continue;
      const key = `${thread.agentGroupId}\0${thread.channel}\0${thread.threadId ?? ""}`;
      if (!activeWinner.has(key)) {
        activeWinner.set(key, thread.sessionId);
      }
    }

    return threads.map((thread) => {
      if (thread.status !== "active") return thread;
      const key = `${thread.agentGroupId}\0${thread.channel}\0${thread.threadId ?? ""}`;
      if (activeWinner.get(key) === thread.sessionId) return thread;
      return { ...thread, status: "archived" as const };
    });
  }

  static extractSessionFromDbPath(dbPath: string): { agentGroupId: string; sessionId: string } | null {
    const normalized = dbPath.replace(/\\/g, "/");
    const marker = "v2-sessions/";
    const idx = normalized.indexOf(marker);
    if (idx < 0) return null;
    const parts = normalized.slice(idx + marker.length).split("/");
    if (parts.length < 3) return null;
    const agentGroupId = parts[0];
    const sessionId = parts[1];
    if (!sessionId?.startsWith("sess-")) return null;
    return { agentGroupId, sessionId };
  }

  private static deriveChannelFromThread(threadId: string | null, fallbackChannel: string): string {
    if (!threadId) return fallbackChannel || "unknown";
    const colon = threadId.indexOf(":");
    if (colon > 0) return threadId.slice(0, colon);
    return fallbackChannel || "unknown";
  }

  private static loadSessionMeta(): Map<
    string,
    {
      thread_id: string | null;
      conversation_id: string | null;
      status: string;
      last_active: string | null;
      created_at: string;
      agent_group_id: string;
    }
  > {
    const meta = new Map<
      string,
      {
        thread_id: string | null;
        conversation_id: string | null;
        status: string;
        last_active: string | null;
        created_at: string;
        agent_group_id: string;
      }
    >();
    if (!fs.existsSync(CONFIG.DB_PATH)) return meta;
    try {
      const db = new Database(CONFIG.DB_PATH, { readonly: true });
      const rows = db
        .query(
          `SELECT id, agent_group_id, thread_id, conversation_id, status, last_active, created_at
           FROM sessions
           WHERE thread_id IS NULL OR thread_id NOT LIKE 'system:%'`,
        )
        .all() as {
        id: string;
        agent_group_id: string;
        thread_id: string | null;
        conversation_id: string | null;
        status: string;
        last_active: string | null;
        created_at: string;
      }[];
      for (const row of rows) meta.set(row.id, row);
      db.close();
    } catch {}
    return meta;
  }

  static getChatThreads(limit = 50): ChatThreadItem[] {
    const sessionRoot = path.join(CONFIG.DATA_PATH, "v2-sessions");
    const sessionMeta = this.loadSessionMeta();
    const threads = new Map<string, ChatThreadItem>();

    const ingestSession = (
      sessionId: string,
      agentGroupId: string,
      sampleChannel: string,
      sampleThreadId: string | null,
    ) => {
      if (threads.has(sessionId)) return;
      const meta = sessionMeta.get(sessionId);
      const threadId = meta?.thread_id ?? sampleThreadId;
      if (threadId?.startsWith("system:")) return;

      const channel = this.deriveChannelFromThread(threadId, sampleChannel);
      const statusRaw = meta?.status ?? "active";
      const status: ChatThreadItem["status"] =
        statusRaw === "archived" || statusRaw === "closed" ? statusRaw : "active";

      threads.set(sessionId, {
        sessionId,
        agentGroupId: meta?.agent_group_id ?? agentGroupId,
        threadId,
        channel,
        status,
        conversationId: meta?.conversation_id ?? null,
        lastActiveAt: meta?.last_active ?? meta?.created_at ?? null,
        messageCount: 0,
        lastPreview: "",
        lastSenderName: "",
      });
    };

    if (fs.existsSync(sessionRoot)) {
      const inbounds = glob.sync(`${sessionRoot}/**/inbound.db`);
      const outbounds = glob.sync(`${sessionRoot}/**/outbound.db`);

      for (const dbPath of [...inbounds, ...outbounds]) {
        const loc = this.extractSessionFromDbPath(dbPath);
        if (!loc) continue;
        try {
          const db = new Database(dbPath, { readonly: true });
          const isInbound = dbPath.endsWith("inbound.db");
          const table = isInbound ? "messages_in" : "messages_out";
          const row = db
            .query(
              `SELECT timestamp, content, channel_type, thread_id FROM ${table}
               WHERE kind IN ('chat', 'chat-sdk', 'system')
               ORDER BY timestamp DESC LIMIT 1`,
            )
            .get() as { timestamp: string; content: string; channel_type: string; thread_id: string | null } | undefined;
          db.close();

          const channel = row?.channel_type || "unknown";
          const threadId = row?.thread_id ?? null;
          ingestSession(loc.sessionId, loc.agentGroupId, channel, threadId);

          const thread = threads.get(loc.sessionId);
          if (!thread) continue;

          const countDb = new Database(dbPath, { readonly: true });
          const countRow = countDb
            .prepare(`SELECT COUNT(*) as count FROM ${table} WHERE kind IN ('chat', 'chat-sdk', 'system')`)
            .get() as { count: number };
          countDb.close();
          thread.messageCount += countRow?.count ?? 0;

          if (row) {
            const parsed = this.parseMessageContent(row.content || "", isInbound ? "user" : "assistant");
            const preview = parsed.text.replace(/\s+/g, " ").trim().slice(0, 120);
            const rowTime = row.timestamp;
            if (!thread.lastActiveAt || Date.parse(rowTime) >= Date.parse(thread.lastActiveAt)) {
              thread.lastActiveAt = rowTime;
              if (preview) thread.lastPreview = preview;
              thread.lastSenderName = parsed.senderName;
            }
          }
        } catch {}
      }
    }

    for (const [sessionId, meta] of sessionMeta) {
      if (meta.thread_id?.startsWith("system:")) continue;
      if (threads.has(sessionId)) continue;
      const channel = this.deriveChannelFromThread(meta.thread_id, "unknown");
      threads.set(sessionId, {
        sessionId,
        agentGroupId: meta.agent_group_id,
        threadId: meta.thread_id,
        channel,
        status: meta.status === "archived" || meta.status === "closed" ? meta.status : "active",
        conversationId: meta.conversation_id,
        lastActiveAt: meta.last_active ?? meta.created_at,
        messageCount: 0,
        lastPreview: "",
        lastSenderName: "",
      });
    }

    return [...threads.values()]
      .sort((a, b) => {
        const tA = Date.parse(a.lastActiveAt || "") || 0;
        const tB = Date.parse(b.lastActiveAt || "") || 0;
        if (tA !== tB) return tB - tA;
        if (a.status === "active" && b.status !== "active") return -1;
        if (b.status === "active" && a.status !== "active") return 1;
        return a.sessionId.localeCompare(b.sessionId);
      })
      .slice(0, limit);
  }

  static getUsageLogs(limit = 200, opts?: { sessionId?: string; agentGroupId?: string }): ChatMessageItem[] {
    const messages: ChatMessageItem[] = [];
    const sessionDir = path.join(CONFIG.DATA_PATH, "v2-sessions");
    if (!fs.existsSync(sessionDir)) return messages;

    const defaultModel = this.getDefaultModel();
    const allSubRuns = this.getDetailedRuns(500);

    try {
      const inboundGlob = opts?.sessionId
        ? `${sessionDir}/**/${opts.sessionId}/inbound.db`
        : `${sessionDir}/**/inbound.db`;
      const outboundGlob = opts?.sessionId
        ? `${sessionDir}/**/${opts.sessionId}/outbound.db`
        : `${sessionDir}/**/outbound.db`;
      const inbounds = glob.sync(inboundGlob);
      const outbounds = glob.sync(outboundGlob);
      const inboundMap = new Map<string, any>();

      for (const inDbPath of inbounds) {
        const sessionLoc = this.extractSessionFromDbPath(inDbPath);
        try {
          const db = new Database(inDbPath, { readonly: true });
          const rows = db.query("SELECT * FROM messages_in ORDER BY timestamp DESC LIMIT ?").all(limit) as any[];
          for (const r of rows) {
            if (r.kind !== "chat" && r.kind !== "chat-sdk" && r.kind !== "system") continue;
            inboundMap.set(r.id, r);
            const parsed = this.parseMessageContent(r.content || "", "user");
            const charCount = parsed.text.length;
            const promptTokens = Math.max(1, Math.round(charCount / 3.5));
            const completionTokens = 0;
            const costInUsd = (promptTokens / 1_000_000) * 0.14;
            const costOutUsd = 0;
            const costUsd = costInUsd;
            const costBrl = CurrencyService.convertUsdToBrl(costUsd);
            const costInBrl = costBrl;
            const costOutBrl = 0;

            messages.push({
              id: r.id,
              seq: r.seq,
              type: "user",
              timestamp: r.timestamp || new Date().toISOString(),
              channel: r.channel_type || "telegram",
              senderName: parsed.senderName,
              text: parsed.text,
              model: defaultModel,
              threadId: parsed.threadId || r.thread_id,
              sessionId: sessionLoc?.sessionId,
              agentGroupId: sessionLoc?.agentGroupId,
              charCount,
              tokens: promptTokens,
              promptTokens,
              completionTokens,
              costInUsd,
              costInBrl,
              costOutUsd,
              costOutBrl,
              costUsd,
              costBrl,
              memo: r.memo || null,
            });
          }
          db.close();
        } catch {}
      }

      for (const outDbPath of outbounds) {
        const sessionLoc = this.extractSessionFromDbPath(outDbPath);
        try {
          const db = new Database(outDbPath, { readonly: true });
          const rows = db.query("SELECT * FROM messages_out ORDER BY timestamp DESC LIMIT ?").all(limit) as any[];
          for (const r of rows) {
            const parsed = this.parseMessageContent(r.content || "", "assistant");
            const charCount = parsed.text.length;

            // Associate subRuns strictly belonging to this turn (between inbound and outbound)
            const outTime = new Date(r.timestamp || new Date()).getTime();
            const inMsg = r.in_reply_to ? inboundMap.get(r.in_reply_to) : null;
            const inTime = inMsg ? new Date(inMsg.timestamp).getTime() : outTime - 30000;

            const matchedRuns = allSubRuns.filter((run) => {
              if (r.in_reply_to && run.messageId) {
                return run.messageId === r.in_reply_to;
              }
              if (inMsg) {
                const runTime = new Date(run.timestamp).getTime();
                return runTime >= inTime && runTime <= outTime + 500;
              }
              return false;
            });

            const model = matchedRuns.find((run) => run.model)?.model || defaultModel;

            let promptTokens = 0;
            let completionTokens = 0;
            let cacheHitTokens = 0;
            let cacheMissTokens = 0;
            let totalTokens = Math.max(1, Math.round(charCount / 3.5));
            let costInUsd = 0;
            let costOutUsd = 0;
            let costUsd = (totalTokens / 1_000_000) * 0.44;

            if (matchedRuns.length > 0) {
              promptTokens = matchedRuns.reduce((acc, run) => acc + (run.promptTokens || 0), 0);
              completionTokens = matchedRuns.reduce((acc, run) => acc + (run.completionTokens || 0), 0);
              cacheHitTokens = matchedRuns.reduce((acc, run) => acc + (run.cacheHitTokens || 0), 0);
              cacheMissTokens = matchedRuns.reduce((acc, run) => acc + (run.cacheMissTokens || 0), 0);
              totalTokens = promptTokens + completionTokens;
              costInUsd = (promptTokens / 1_000_000) * 0.14;
              costOutUsd = (completionTokens / 1_000_000) * 0.28;
              costUsd = matchedRuns.reduce((acc, run) => acc + (run.costUsd || 0), 0) || (costInUsd + costOutUsd);
            } else {
              promptTokens = Math.round(totalTokens * 0.6);
              completionTokens = Math.max(0, totalTokens - promptTokens);
              costInUsd = (promptTokens / 1_000_000) * 0.14;
              costOutUsd = (completionTokens / 1_000_000) * 0.28;
              costUsd = costInUsd + costOutUsd;
            }

            const costBrl = CurrencyService.convertUsdToBrl(costUsd);
            const costInBrl = CurrencyService.convertUsdToBrl(costInUsd);
            const costOutBrl = CurrencyService.convertUsdToBrl(costOutUsd);
            const cacheHitRatio = promptTokens > 0 ? `${Math.round((cacheHitTokens / promptTokens) * 100)}%` : "0%";

            messages.push({
              id: r.id,
              seq: r.seq,
              type: "assistant",
              timestamp: r.timestamp || new Date().toISOString(),
              channel: r.channel_type || "telegram",
              senderName: parsed.senderName || "Assistente",
              text: parsed.text,
              model,
              threadId: r.thread_id,
              sessionId: sessionLoc?.sessionId,
              agentGroupId: sessionLoc?.agentGroupId,
              charCount,
              tokens: totalTokens,
              promptTokens,
              completionTokens,
              cacheHitTokens,
              cacheMissTokens,
              cacheHitRatio,
              costInUsd,
              costInBrl,
              costOutUsd,
              costOutBrl,
              costUsd,
              costBrl,
              memo: r.memo || null,
              subRuns: matchedRuns.length > 0 ? matchedRuns : undefined,
            });
          }
          db.close();
        } catch {}
      }
    } catch {}

    messages.sort((a, b) => {
      const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (timeDiff !== 0) return timeDiff;
      return (b.seq || 0) - (a.seq || 0);
    });
    return messages.slice(0, limit);
  }

  static getDetailedRuns(limit = 100): IntermediateRunItem[] {
    return this.getDetailedRunsWithTotal(limit).runs;
  }

  static getDetailedRunsWithTotal(
    limit?: number,
    offset = 0,
  ): { runs: IntermediateRunItem[]; total: number } {
    const { records: ledgerRecords, total } = this.getRealTokenRecordsWithTotal(limit, offset);
    const defaultModel = this.getDefaultModel();
    const runs: IntermediateRunItem[] = [];
    for (const rec of ledgerRecords) {
      const purpose = resolvePurpose({
        purpose: rec.purpose,
        preview: rec.preview,
        hasToolCalls: rec.hasToolCalls,
        toolCallsCount: rec.toolCallsCount,
      });
      const meta = getPurposeMeta(purpose);
      const toolName = parseToolNameFromPreview(rec.preview);
      const label = formatPurposeLabel(purpose, { toolName: toolName || undefined });

      const promptTokens = rec.promptTokens || 0;
      const completionTokens = rec.completionTokens || 0;
      const costInUsd = rec.cacheHitTokens
        ? (rec.cacheHitTokens / 1_000_000) * 0.014 + (rec.cacheMissTokens / 1_000_000) * 0.14
        : (promptTokens / 1_000_000) * 0.14;
      const costOutUsd = (completionTokens / 1_000_000) * 0.28;

      runs.push({
        id: rec.id,
        messageId: rec.messageId || rec.id,
        sessionId: rec.sessionId,
        type: meta.uiType,
        purpose,
        label,
        shortLabel: meta.shortLabel,
        timestamp: rec.timestamp,
        model: rec.model || defaultModel,
        charCount: rec.totalTokens * 4,
        tokens: rec.totalTokens,
        promptTokens,
        cacheHitTokens: rec.cacheHitTokens,
        cacheMissTokens: rec.cacheMissTokens,
        completionTokens,
        costInUsd,
        costOutUsd,
        costUsd: rec.costUsd || (costInUsd + costOutUsd),
        costBrl: rec.costBrl,
        latencyMs: rec.latencyMs,
        toolName: toolName || (meta.purpose === 'stage1_action' ? 'Ferramenta' : undefined),
        rawContent: rec.content || rec.preview || "",
        preview: rec.preview || label,
      });
    }

    return {
      runs,
      total,
    };
  }

  /** Traces estruturados de agent_audit.jsonl (supervisor, workers, triagem, sender). */
  static getAgentAuditTraces(limit = 300, groupFolder?: string): AgentAuditTraceItem[] {
    return this.getAgentAuditTracesWithTotal(limit, groupFolder).traces;
  }

  static getAgentAuditTracesWithTotal(
    limit?: number,
    groupFolder?: string,
    offset = 0,
  ): { traces: AgentAuditTraceItem[]; total: number } {
    const traces: AgentAuditTraceItem[] = [];

    const auditFiles = groupFolder
      ? [path.join(CONFIG.GROUPS_PATH, groupFolder, "logs", "agent_audit.jsonl")].filter((f) =>
          fs.existsSync(f)
        )
      : glob.sync(`${CONFIG.GROUPS_PATH}/**/logs/agent_audit.jsonl`);

    for (const file of auditFiles) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const lines = content.split("\n");
        traces.push(...parseAgentAuditJsonl(lines, traces.length));
      } catch {}
    }

    traces.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const start = Math.max(0, offset);
    const end = typeof limit === "number" ? start + limit : undefined;
    return {
      traces: traces.slice(start, end),
      total: traces.length,
    };
  }

  static getScheduledTasks(groupFolder?: string) {
    return listScheduledTasks(groupFolder);
  }

  static updateScheduledTask(taskId: string, data: { cron?: string; prompt?: string }) {
    return updateOfficialTask(taskId, data);
  }

  static cancelScheduledTask(taskId: string) {
    return cancelOfficialTask(taskId);
  }

  static pauseScheduledTask(taskId: string) {
    return pauseOfficialTask(taskId);
  }

  static resumeScheduledTask(taskId: string) {
    return resumeOfficialTask(taskId);
  }

  static getCronExecutionLogs(limit?: number, groupFolder?: string, offset = 0) {
    return getTaskExecutionLogs(limit, groupFolder, offset);
  }

  static getCronExecutionLogsWithTotal(limit?: number, groupFolder?: string, offset = 0) {
    return getTaskExecutionLogsWithTotal(limit, groupFolder, offset);
  }
}
