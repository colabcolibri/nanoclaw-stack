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
  private static getFilePath(groupFolder: string): string {
    return path.join(CONFIG.GROUPS_PATH, groupFolder, 'yampi_tokens.json');
  }

  private static maskSecret(value: string): string {
    if (!value) return '';
    if (value.length <= 8) return '••••••••';
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }

  static getStatus(groupFolder: string) {
    const creds = this.getCredentials(groupFolder);
    if (!creds) return { connected: false as const };

    return {
      connected: true as const,
      alias: creds.alias,
      maskedUserToken: this.maskSecret(creds.userToken),
      maskedUserSecret: this.maskSecret(creds.userSecretKey),
      updatedAt: creds.updatedAt || null,
    };
  }

  static getCredentials(groupFolder: string): YampiCredentials | null {
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

  static saveCredentials(creds: YampiCredentials, groupFolder: string): void {
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

  static removeCredentials(groupFolder: string): void {
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
