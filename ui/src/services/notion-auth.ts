import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';

export class NotionAuthService {
  private static getTokenFilePath(folder: string = 'barao'): string {
    return path.join(CONFIG.NANOCLAW_PATH, 'groups', folder, 'notion_tokens.json');
  }

  static getStatus(folder: string = 'barao') {
    const filePath = this.getTokenFilePath(folder);
    if (!fs.existsSync(filePath)) {
      return { connected: false };
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const apiKey = data.apiKey || data.access_token || '';
      if (!apiKey) return { connected: false };

      const maskedKey = apiKey.length > 10 ? `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}` : '••••••••';
      return {
        connected: true,
        maskedKey,
        botName: data.botName || 'Notion Integration',
        defaultDatabaseId: data.defaultDatabaseId || '',
        updatedAt: data.updatedAt || '',
      };
    } catch {
      return { connected: false };
    }
  }

  static async connect(folder: string = 'barao', apiKey: string, defaultDatabaseId?: string) {
    if (!apiKey || !apiKey.trim()) {
      return { success: false, error: 'Chave de API do Notion é obrigatória.' };
    }

    const cleanKey = apiKey.trim();

    try {
      // Test token with Notion API
      const testRes = await fetch('https://api.notion.com/v1/users/me', {
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          'Notion-Version': '2022-06-28',
        },
      });

      if (!testRes.ok) {
        const errText = await testRes.text();
        return { success: false, error: `Falha na autenticação do Notion (${testRes.status}): ${errText}` };
      }

      const userData = (await testRes.json()) as any;
      const botName = userData.name || userData.bot?.owner?.user?.name || 'Notion Integration';

      const filePath = this.getTokenFilePath(folder);
      const groupDir = path.dirname(filePath);
      if (!fs.existsSync(groupDir)) {
        fs.mkdirSync(groupDir, { recursive: true });
      }

      fs.writeFileSync(
        filePath,
        JSON.stringify(
          {
            apiKey: cleanKey,
            botName,
            defaultDatabaseId: (defaultDatabaseId || '').trim(),
            updatedAt: new Date().toISOString(),
          },
          null,
          2
        ),
        { mode: 0o600 }
      );

      return { success: true, botName };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  }

  static disconnect(folder: string = 'barao'): boolean {
    const filePath = this.getTokenFilePath(folder);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
}
