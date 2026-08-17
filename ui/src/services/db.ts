import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import glob from "fast-glob";
import { CONFIG } from "../config.js";

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
  costUsd?: number;
  costBrl?: number;
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
    const totalInbound = messages.filter((m) => m.type === "user").length;
    const totalOutbound = messages.filter((m) => m.type === "assistant").length;
    const totalTokens = messages.reduce((acc, m) => acc + (m.tokens || 0), 0);
    const totalCostUsd = messages.reduce((acc, m) => acc + (m.costUsd || 0), 0);
    const totalCostBrl = totalCostUsd * 5.7;

    return {
      totalSessions,
      totalUsers,
      activeGroups,
      totalMessages: messages.length,
      totalRuns: runs.length,
      totalInbound,
      totalOutbound,
      estimatedTokens: totalTokens,
      estimatedCostUsd: totalCostUsd.toFixed(5),
      estimatedCostBrl: totalCostBrl.toFixed(4),
      modelName: "DeepSeek V4 Flash / Chat",
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

      for (const outDbPath of outbounds) {
        try {
          const db = new Database(outDbPath, { readonly: true });
          const rows = db.query("SELECT * FROM messages_out ORDER BY timestamp DESC LIMIT ?").all(limit) as any[];
          for (const r of rows) {
            const parsed = this.parseMessageContent(r.content || "", "assistant");
            const charCount = parsed.text.length;
            const tokens = Math.max(1, Math.round(charCount / 3.5));
            const costUsd = (tokens / 1_000_000) * 0.28;
            const costBrl = costUsd * 5.7;

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
              tokens,
              costUsd,
              costBrl,
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
    const sessionDir = path.join(CONFIG.DATA_PATH, "v2-sessions");
    if (!fs.existsSync(sessionDir)) return runs;

    try {
      const opencodeDbs = glob.sync(`${sessionDir}/**/opencode.db`);
      for (const dbPath of opencodeDbs) {
        try {
          const db = new Database(dbPath, { readonly: true });
          const rows = db.query("SELECT * FROM part ORDER BY time_created DESC LIMIT ?").all(limit) as any[];
          for (const r of rows) {
            let parsedData: any = {};
            try {
              parsedData = JSON.parse(r.data || "{}");
            } catch {
              parsedData = { text: r.data };
            }

            const rawText = parsedData.text || JSON.stringify(parsedData);
            const charCount = rawText.length;
            const tokens = Math.max(1, Math.round(charCount / 3.5));
            const isInputStep = rawText.includes("<system>") || parsedData.type === "tool_result";
            const costRate = isInputStep ? 0.14 : 0.28;
            const costUsd = (tokens / 1_000_000) * costRate;
            const costBrl = costUsd * 5.7;

            let systemPrompt = "";
            const sysMatch = rawText.match(/<system>([\s\S]*?)<\/system>/);
            if (sysMatch) systemPrompt = sysMatch[1].trim();

            let userPrompt = "";
            const userMatch = rawText.match(/<message[^>]*>([\s\S]*?)<\/message>/);
            if (userMatch) userPrompt = userMatch[1].trim();

            let preview = rawText;
            if (parsedData.type === "tool_use") {
              preview = `🔧 Tool Call: ${parsedData.name || "ferramenta"}`;
            } else if (parsedData.type === "tool_result") {
              preview = `📋 Tool Result: ${JSON.stringify(parsedData.output || "").slice(0, 100)}`;
            } else if (userPrompt) {
              preview = `👤 Prompt: ${userPrompt.slice(0, 100)}`;
            }

            runs.push({
              id: r.id,
              messageId: r.message_id,
              sessionId: r.session_id,
              type: parsedData.type || "text_turn",
              timestamp: new Date(r.time_created).toISOString(),
              charCount,
              tokens,
              costUsd,
              costBrl,
              systemPrompt,
              userPrompt,
              toolName: parsedData.name,
              toolArgs: parsedData.input || parsedData.args,
              toolResult: parsedData.output || parsedData.result,
              rawContent: rawText,
              preview,
            });
          }
          db.close();
        } catch {}
      }
    } catch {}

    runs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return runs.slice(0, limit);
  }
}
