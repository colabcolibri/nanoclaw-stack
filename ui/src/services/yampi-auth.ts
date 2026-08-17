import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';

export interface YampiCredentials {
  alias: string;
  userToken: string;
  userSecretKey: string;
  updatedAt?: string;
}

export class YampiAuthService {
  private static getFilePath(groupFolder = 'barao'): string {
    return path.join(CONFIG.GROUPS_PATH, groupFolder, 'yampi_tokens.json');
  }

  static getCredentials(groupFolder = 'barao'): YampiCredentials | null {
    const filePath = this.getFilePath(groupFolder);
    if (!fs.existsSync(filePath)) return null;

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (data.alias && data.userToken && data.userSecretKey) {
        return data;
      }
    } catch {}
    return null;
  }

  static saveCredentials(creds: YampiCredentials, groupFolder = 'barao'): void {
    const filePath = this.getFilePath(groupFolder);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const payload: YampiCredentials = {
      alias: creds.alias.trim(),
      userToken: creds.userToken.trim(),
      userSecretKey: creds.userSecretKey.trim(),
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  }

  static removeCredentials(groupFolder = 'barao'): void {
    const filePath = this.getFilePath(groupFolder);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {}
    }
  }

  static async testConnection(creds: YampiCredentials): Promise<{ success: boolean; storeName?: string; error?: string }> {
    try {
      const res = await fetch(`https://api.dooki.com.br/v2/${creds.alias}/catalog/products?limit=1`, {
        headers: {
          'User-Token': creds.userToken,
          'User-Secret-Key': creds.userSecretKey,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `Yampi API Error (${res.status}): ${errText}` };
      }

      return { success: true, storeName: creds.alias };
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha ao conectar com a API da Yampi.' };
    }
  }
}
