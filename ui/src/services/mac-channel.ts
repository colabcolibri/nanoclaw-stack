import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CONFIG } from '../config.js';
import { GroupManager } from './groups.js';

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
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ apiKey: newKey }, null, 2), 'utf-8');
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
   * Executes a user prompt through the NanoClaw TurnOrchestrator engine with all native tools and skills.
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

    // Ensure SQLite schema on both inbound & outbound DBs
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

    // Record user message arrival timestamp BEFORE turn starts
    const requestTimestamp = new Date().toISOString();
    const userMsgId = `msg-mac-in-${Date.now()}`;
    inDb.run(
      `INSERT INTO messages_in (id, timestamp, kind, channel_type, thread_id, content) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userMsgId,
        requestTimestamp,
        'chat',
        'macos',
        'mac:sergio',
        JSON.stringify({ text: prompt, sender: 'MacBook (Sérgio)', channel: 'macos' }),
      ]
    );

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

      combined.sort((a, b) => {
        const tA = new Date(a.timestamp).getTime();
        const tB = new Date(b.timestamp).getTime();
        if (tA !== tB) return tA - tB;
        if (a.role === 'user' && b.role === 'assistant') return -1;
        if (a.role === 'assistant' && b.role === 'user') return 1;
        return 0;
      });
      history = combined.slice(-30).map((c) => ({ role: c.role, content: c.text }));
    } catch {}

    // Load group configuration, soul directives and skills
    const groupDir = path.join(CONFIG.GROUPS_PATH, groupFolder);
    const soulFile = path.join(groupDir, 'instructions.prepend.md');
    let soulContent = 'Você é o Barão, um assistente de IA prestativo e inteligente.';
    if (fs.existsSync(soulFile)) {
      soulContent = fs.readFileSync(soulFile, 'utf-8').trim();
    }

    // Load available skill instructions and references
    const skillsDir = path.join(CONFIG.NANOCLAW_PATH, 'container', 'skills');
    const skillParts: string[] = [];
    if (fs.existsSync(skillsDir)) {
      for (const skillName of fs.readdirSync(skillsDir)) {
        const skillDoc = path.join(skillsDir, skillName, 'SKILL.md');
        if (fs.existsSync(skillDoc)) {
          const doc = fs.readFileSync(skillDoc, 'utf-8');
          skillParts.push(`### Skill: ${skillName}\n${doc}`);
        }
      }
    }

    const systemParts = [
      soulContent,
      `## Personalização Local:\nVocê está interagindo diretamente com o Sérgio Luciano através do seu aplicativo oficial nativo no macOS. Seja objetivo, resolutivo e mantenha um tom de parceria executiva inteligente.`,
    ];

    if (skillParts.length > 0) {
      systemParts.push(`## Habilidades Disponíveis:\n${skillParts.join('\n\n')}`);
    }

    // Connectors: primary Groq with deep fallback to DeepSeek
    const groqKey = process.env.GROQ_API_KEY;
    const deepseekKey = process.env.DEEPSEEK_API_KEY;

    let baseURL = 'https://api.groq.com/openai/v1';
    let apiKey = groqKey;
    let modelName = 'llama-3.3-70b-versatile';

    if (!apiKey && deepseekKey) {
      baseURL = 'https://api.deepseek.com/v1';
      apiKey = deepseekKey;
      modelName = 'deepseek-chat';
    }

    if (!apiKey) {
      inDb.close();
      outDb.close();
      throw new Error('Nenhuma chave de provedor LLM configurada no servidor (GROQ ou DEEPSEEK).');
    }

    // Import tools and turn orchestrator directly
    const { AGENT_TOOLS } = await import(
      path.join(CONFIG.NANOCLAW_PATH, 'container', 'agent-runner', 'src', 'tools', 'index.ts')
    );
    const { TurnOrchestrator } = await import(
      path.join(CONFIG.NANOCLAW_PATH, 'container', 'agent-runner', 'src', 'orchestrator', 'turn-orchestrator.ts')
    );

    const { MemoryManager } = await import(
      path.join(CONFIG.NANOCLAW_PATH, 'container', 'agent-runner', 'src', 'services', 'memory.ts')
    );
    const coreMemory = MemoryManager.loadCoreMemory(groupDir);

    const finalSystem = [
      ...systemParts,
      coreMemory,
      `Você possui ferramentas nativas conectadas para Notion, Google Calendar, Gmail, Yampi Store e Memória. Sempre execute a ferramenta apropriada quando solicitado.`,
    ].join('\n\n');

    // Completion function contract
    const completeFn = async (messages: any[], tools?: any[]) => {
      const payload: any = {
        model: modelName,
        messages: messages.map((m) => {
          const formatted: any = { role: m.role, content: m.content || '' };
          if (m.tool_calls) formatted.tool_calls = m.tool_calls;
          if (m.tool_call_id) formatted.tool_call_id = m.tool_call_id;
          return formatted;
        }),
      };
      if (tools && tools.length > 0) {
        payload.tools = tools;
        payload.tool_choice = 'auto';
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
        throw new Error(`LLM API Error (${res.status}): ${errText}`);
      }

      const data = (await res.json()) as any;
      const msg = data.choices?.[0]?.message || {};
      return {
        content: msg.content,
        tool_calls: msg.tool_calls,
      };
    };

    // Execute conversational turn with full tool orchestration and schema awareness
    const turnResult = await TurnOrchestrator.runTurn(completeFn, {
      prompt,
      cwd: groupDir,
      chatJid: 'mac:sergio',
      history,
      systemInstructions: finalSystem,
      historyLimit: 30,
    });

    const cleanReply = turnResult.deliveredText
      .replace(/<message[^>]*>/gi, '')
      .replace(/<\/message>/gi, '')
      .trim();

    // Record response timestamp AFTER turn finished
    const responseTimestamp = new Date().toISOString();
    const assistantMsgId = `msg-mac-out-${Date.now()}`;

    inDb.close();

    outDb.run(
      `INSERT INTO messages_out (id, timestamp, kind, channel_type, thread_id, content) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        assistantMsgId,
        responseTimestamp,
        'chat',
        'macos',
        'mac:sergio',
        `<message to="mac:sergio">\n${cleanReply}\n</message>`,
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
          ['sess-macos-sergio', agentGroupId, responseTimestamp, responseTimestamp]
        );
      } catch {}
      centralDb.close();
    }

    return {
      reply: cleanReply,
      timestamp: responseTimestamp,
    };
  }

  /**
   * Retrieves conversation history for the macOS session.
   */
  static async getHistory(
    groupFolder = 'barao',
    limit = 50
  ): Promise<Array<{ id: string; role: 'user' | 'assistant'; text: string; timestamp: string }>> {
    const { Database } = await import('bun:sqlite');
    const agentGroupId = 'ag-4c9ad14f-4032-4305-8efc-0cd8b700042c';
    const sessionDir = path.join(CONFIG.DATA_PATH, 'v2-sessions', agentGroupId, 'sess-macos-sergio');
    if (!fs.existsSync(sessionDir)) return [];

    const inDbPath = path.join(sessionDir, 'inbound.db');
    const outDbPath = path.join(sessionDir, 'outbound.db');

    const combined: Array<{ id: string; role: 'user' | 'assistant'; text: string; timestamp: string }> = [];

    if (fs.existsSync(inDbPath)) {
      try {
        const inDb = new Database(inDbPath, { readonly: true });
        const inRows = inDb.query(`SELECT id, timestamp, content FROM messages_in ORDER BY timestamp DESC LIMIT ?`).all(limit) as any[];
        inDb.close();
        for (const r of inRows) {
          let text = r.content || '';
          try {
            if (text.startsWith('{')) {
              const parsed = JSON.parse(text);
              text = parsed.text || parsed.content || text;
            }
          } catch {}
          combined.push({ id: r.id || `in-${r.timestamp}`, role: 'user', text, timestamp: r.timestamp });
        }
      } catch {}
    }

    if (fs.existsSync(outDbPath)) {
      try {
        const outDb = new Database(outDbPath, { readonly: true });
        const outRows = outDb.query(`SELECT id, timestamp, content FROM messages_out ORDER BY timestamp DESC LIMIT ?`).all(limit) as any[];
        outDb.close();
        for (const r of outRows) {
          let text = (r.content || '')
            .replace(/<message[^>]*>/gi, '')
            .replace(/<\/message>/gi, '')
            .trim();
          combined.push({ id: r.id || `out-${r.timestamp}`, role: 'assistant', text, timestamp: r.timestamp });
        }
      } catch {}
    }

    combined.sort((a, b) => {
      const tA = new Date(a.timestamp).getTime();
      const tB = new Date(b.timestamp).getTime();
      if (tA !== tB) return tA - tB;
      if (a.role === 'user' && b.role === 'assistant') return -1;
      if (a.role === 'assistant' && b.role === 'user') return 1;
      return 0;
    });
    return combined.slice(-limit);
  }

  /**
   * Resets the conversation history for macOS session.
   */
  static async resetSession(groupFolder = 'barao'): Promise<boolean> {
    const { Database } = await import('bun:sqlite');
    const agentGroupId = 'ag-4c9ad14f-4032-4305-8efc-0cd8b700042c';
    const sessionDir = path.join(CONFIG.DATA_PATH, 'v2-sessions', agentGroupId, 'sess-macos-sergio');
    if (!fs.existsSync(sessionDir)) return true;

    const inDbPath = path.join(sessionDir, 'inbound.db');
    const outDbPath = path.join(sessionDir, 'outbound.db');

    if (fs.existsSync(inDbPath)) {
      try {
        const inDb = new Database(inDbPath);
        inDb.run(`DELETE FROM messages_in`);
        inDb.close();
      } catch {}
    }

    if (fs.existsSync(outDbPath)) {
      try {
        const outDb = new Database(outDbPath);
        outDb.run(`DELETE FROM messages_out`);
        outDb.close();
      } catch {}
    }

    return true;
  }

  /**
   * Transcribes incoming audio via local Whisper ASR and executes the prompt.
   */
  static async processAudio(
    audioBlob: Blob | ArrayBuffer | Uint8Array,
    groupFolder = 'barao'
  ): Promise<{ transcription: string; reply: string; timestamp: string }> {
    const formData = new FormData();
    const blob = audioBlob instanceof Blob ? audioBlob : new Blob([audioBlob as any], { type: 'audio/m4a' });
    formData.append('audio_file', blob, 'recording.m4a');

    let transcription = '';
    try {
      const whisperRes = await fetch('http://127.0.0.1:9000/asr?encode=true&task=transcribe&language=pt&output=json', {
        method: 'POST',
        body: formData,
      });

      if (!whisperRes.ok) {
        const err = await whisperRes.text();
        throw new Error(`Whisper ASR error (${whisperRes.status}): ${err}`);
      }

      const whisperData = (await whisperRes.json()) as { text?: string };
      transcription = (whisperData.text || '').trim();
    } catch (e: any) {
      throw new Error(`Falha na transcrição de voz: ${e.message}`);
    }

    if (!transcription) {
      throw new Error('Nenhum áudio inteligível detectado pelo Whisper.');
    }

    const result = await this.processPrompt(transcription, groupFolder, false);
    return {
      transcription,
      reply: result.reply,
      timestamp: result.timestamp,
    };
  }
}

