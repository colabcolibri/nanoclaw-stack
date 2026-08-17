import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CONFIG } from '../config.js';
import { DatabaseService } from './db.js';
import { GroupManager } from './groups.js';

interface MacSessionState {
  apiKey: string;
  history: Array<{ role: string; content?: string; [key: string]: any }>;
  updatedAt: string;
}

export class MacChannelService {
  private static getKeyFilePath(groupFolder = 'barao'): string {
    return path.join(CONFIG.GROUPS_PATH, groupFolder, 'mac_channel.json');
  }

  /**
   * Retrieves or initializes the dedicated API key for Mac integration.
   */
  static getOrCreateApiKey(groupFolder = 'barao'): string {
    const filePath = this.getKeyFilePath(groupFolder);
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (data.apiKey) return data.apiKey;
      } catch {}
    }

    const newKey = `mac_${crypto.randomBytes(24).toString('hex')}`;
    const initialData: MacSessionState = {
      apiKey: newKey,
      history: [],
      updatedAt: new Date().toISOString(),
    };

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2), 'utf-8');
    return newKey;
  }

  /**
   * Validates the provided Bearer token against the group's API key.
   */
  static validateApiKey(token: string, groupFolder = 'barao'): boolean {
    const expected = this.getOrCreateApiKey(groupFolder);
    if (!token || !expected) return false;
    return token.trim() === expected.trim();
  }

  /**
   * Executes a user prompt through the NanoClaw turn execution engine with session continuity via SQLite.
   */
  static async processPrompt(
    prompt: string,
    groupFolder = 'barao',
    resetSession = false
  ): Promise<{ reply: string; timestamp: string }> {
    const { Database } = await import('bun:sqlite');
    const agentGroupId = 'ag-4c9ad14f-4032-4305-8efc-0cd8b700042c';
    const sessionDir = path.join(CONFIG.DATA_PATH, 'v2-sessions', agentGroupId, 'sess-macos-sergio');
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

    const inDbPath = path.join(sessionDir, 'inbound.db');
    const outDbPath = path.join(sessionDir, 'outbound.db');

    // Ensure schema on both SQLite databases
    const inDb = new Database(inDbPath);
    inDb.run(`CREATE TABLE IF NOT EXISTS messages_in (
      id TEXT PRIMARY KEY,
      seq INTEGER,
      in_reply_to TEXT,
      timestamp TEXT NOT NULL,
      deliver_after TEXT,
      recurrence TEXT,
      kind TEXT NOT NULL,
      platform_id TEXT,
      channel_type TEXT,
      thread_id TEXT,
      content TEXT NOT NULL
    )`);

    const outDb = new Database(outDbPath);
    outDb.run(`CREATE TABLE IF NOT EXISTS messages_out (
      id TEXT PRIMARY KEY,
      seq INTEGER,
      in_reply_to TEXT,
      timestamp TEXT NOT NULL,
      deliver_after TEXT,
      recurrence TEXT,
      kind TEXT NOT NULL,
      platform_id TEXT,
      channel_type TEXT,
      thread_id TEXT,
      content TEXT NOT NULL
    )`);

    if (resetSession) {
      inDb.run(`DELETE FROM messages_in`);
      outDb.run(`DELETE FROM messages_out`);
    }

    // Read previous conversation history directly from SQLite
    let history: Array<{ role: string; content?: string }> = [];
    try {
      const inRows = inDb.query(`SELECT timestamp, content FROM messages_in ORDER BY timestamp ASC`).all() as any[];
      const outRows = outDb.query(`SELECT timestamp, content FROM messages_out ORDER BY timestamp ASC`).all() as any[];

      const combined: Array<{ timestamp: string; role: 'user' | 'assistant'; text: string }> = [];

      for (const r of inRows) {
        let text = r.content || '';
        try {
          if (text.startsWith('{')) {
            const parsed = JSON.parse(text);
            text = parsed.text || parsed.content || text;
          }
        } catch {}
        combined.push({ timestamp: r.timestamp, role: 'user', text });
      }

      for (const r of outRows) {
        let text = (r.content || '')
          .replace(/<message[^>]*>/gi, '')
          .replace(/<\/message>/gi, '')
          .trim();
        combined.push({ timestamp: r.timestamp, role: 'assistant', text });
      }

      combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      history = combined.slice(-30).map((c) => ({ role: c.role, content: c.text }));
    } catch {}

    // Load group configuration and soul
    const groupDir = path.join(CONFIG.GROUPS_PATH, groupFolder);
    const soulFile = path.join(groupDir, 'instructions.prepend.md');
    let soulContent = 'Você é o Barão, um assistente de IA prestativo e inteligente.';
    if (fs.existsSync(soulFile)) {
      soulContent = fs.readFileSync(soulFile, 'utf-8').trim();
    }

    const envMap = GroupManager.readNanoClawEnv();
    const apiKey = envMap['DEEPSEEK_API_KEY'] || process.env.DEEPSEEK_API_KEY || '';
    const baseURL = (envMap['DEEPSEEK_BASE_URL'] || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
    const model = (envMap['DEEPSEEK_MODEL'] || process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash').replace(/^deepseek\//, '');

    if (!apiKey) {
      inDb.close();
      outDb.close();
      throw new Error('DEEPSEEK_API_KEY não configurada no NanoClaw.');
    }

    // Dynamic import of agent tools from container runner
    let agentTools: any[] = [];
    let executeToolFn: any = null;

    try {
      const toolsModule = await import('../../nanoclaw/container/agent-runner/src/tools/index.js');
      agentTools = toolsModule.AGENT_TOOLS || [];
      executeToolFn = toolsModule.executeTool;
    } catch {
      // Fallback if direct import is restricted
    }

    const systemParts = [
      soulContent,
      `Você está conversando diretamente com o usuário através do canal macOS (MacBook).`,
      `Responda de forma concisa, elegante e em linguagem natural em Português.`,
    ];

    const messages: any[] = [
      { role: 'system', content: systemParts.join('\n\n') },
      ...history,
      { role: 'user', content: prompt },
    ];

    let currentMessages = [...messages];
    let finalContent = '';
    const maxIterations = 6;

    for (let iter = 0; iter < maxIterations; iter++) {
      const payload: any = {
        model,
        messages: currentMessages,
        stream: false,
      };

      if (agentTools.length > 0) {
        payload.tools = agentTools;
      }

      const res = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        inDb.close();
        outDb.close();
        throw new Error(`DeepSeek API Error (${res.status}): ${errText}`);
      }

      const data = (await res.json()) as any;
      const assistantMsg = data.choices?.[0]?.message;
      if (!assistantMsg) break;

      // Check tool calls (JSON or DSML)
      const toolCalls = assistantMsg.tool_calls;
      if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0 && executeToolFn) {
        currentMessages.push(assistantMsg);

        for (const call of toolCalls) {
          let fnArgs = {};
          try {
            fnArgs = typeof call.function?.arguments === 'string'
              ? JSON.parse(call.function.arguments)
              : (call.function?.arguments || {});
          } catch {}

          const resultText = await executeToolFn(call.function?.name, fnArgs, groupDir);

          currentMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.function?.name,
            content: resultText,
          });
        }
        continue;
      }

      finalContent = (assistantMsg.content || '')
        .replace(/<[｜|]{1,2}DSML[｜|]{1,2}[\s\S]*?>/gi, '')
        .replace(/<\/[｜|]{1,2}DSML[｜|]{1,2}[\s\S]*?>/gi, '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<message[^>]*>/gi, '')
        .replace(/<\/message>/gi, '')
        .trim();
      break;
    }

    if (!finalContent || !finalContent.trim()) {
      finalContent = 'Ação concluída com sucesso.';
    }

    const now = new Date().toISOString();
    const userMsgId = `msg-mac-in-${Date.now()}`;
    const assistantMsgId = `msg-mac-out-${Date.now() + 1}`;

    // Insert User Inbound message
    inDb.run(
      `INSERT INTO messages_in (id, timestamp, kind, channel_type, thread_id, content) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userMsgId,
        now,
        'chat',
        'macos',
        'mac:sergio',
        JSON.stringify({ text: prompt, sender: 'MacBook (Sérgio)', channel: 'macos' }),
      ]
    );
    inDb.close();

    // Insert Assistant Outbound message
    outDb.run(
      `INSERT INTO messages_out (id, timestamp, kind, channel_type, thread_id, content) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        assistantMsgId,
        now,
        'chat',
        'macos',
        'mac:sergio',
        `<message to="mac:sergio">\n${finalContent}\n</message>`,
      ]
    );
    outDb.close();

    // Register session in central v2.db
    if (fs.existsSync(CONFIG.DB_PATH)) {
      const centralDb = new Database(CONFIG.DB_PATH);
      try {
        centralDb.run(
          `INSERT INTO sessions (id, agent_group_id, created_at, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at`,
          ['sess-macos-sergio', agentGroupId, now, now]
        );
      } catch {}
      centralDb.close();
    }

    return {
      reply: finalContent,
      timestamp: now,
    };
  }
}
