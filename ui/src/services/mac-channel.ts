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
   * Executes a user prompt through the NanoClaw turn execution engine with session continuity.
   */
  static async processPrompt(
    prompt: string,
    groupFolder = 'barao',
    resetSession = false
  ): Promise<{ reply: string; timestamp: string }> {
    const filePath = this.getKeyFilePath(groupFolder);
    let state: MacSessionState = {
      apiKey: this.getOrCreateApiKey(groupFolder),
      history: [],
      updatedAt: new Date().toISOString(),
    };

    if (fs.existsSync(filePath)) {
      try {
        state = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {}
    }

    if (resetSession) {
      state.history = [];
    }

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
      ...state.history,
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
    const userMsgId = `mac-in-${Date.now()}`;
    const assistantMsgId = `mac-out-${Date.now() + 1}`;

    // Persist continuous session history (keep last 50 messages)
    state.history = [
      ...state.history,
      {
        id: userMsgId,
        role: 'user',
        content: prompt,
        timestamp: now,
        channel: 'macos',
      },
      {
        id: assistantMsgId,
        role: 'assistant',
        content: finalContent,
        timestamp: new Date().toISOString(),
        channel: 'macos',
      },
    ].slice(-50);
    state.updatedAt = now;

    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');

    return {
      reply: finalContent,
      timestamp: now,
    };
  }
}
