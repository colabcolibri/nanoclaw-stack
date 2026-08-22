import crypto from 'node:crypto';
import fs from 'node:fs';
import { Database } from 'bun:sqlite';
import { CONFIG } from '../config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function deriveKey(encryptionKey: string): Buffer {
  return crypto.createHash('sha256').update(encryptionKey, 'utf8').digest();
}

function encryptSecret(plaintext: string, encryptionKey: string): string {
  const key = deriveKey(encryptionKey);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function getEncryptionKey(): string {
  const fromProcess = process.env.NANOCLAW_CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (fromProcess) return fromProcess;
  const fromNanoclawEnv = readEnvKey('NANOCLAW_CREDENTIALS_ENCRYPTION_KEY');
  if (fromNanoclawEnv) return fromNanoclawEnv;
  throw new Error(
    'NANOCLAW_CREDENTIALS_ENCRYPTION_KEY não configurada. Defina em nanoclaw/.env no host.',
  );
}

function readEnvKey(keyEnvName: string): string {
  const envFile = `${CONFIG.NANOCLAW_PATH}/.env`;
  if (!fs.existsSync(envFile)) return '';
  const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [k, ...v] = trimmed.split('=');
    if (k?.trim() === keyEnvName) return v.join('=').trim();
  }
  return '';
}

export class LlmCredentialsService {
  static setProviderApiKey(providerId: string, apiKey: string): void {
    const db = new Database(CONFIG.DB_PATH);
    try {
      const ciphertext = encryptSecret(apiKey.trim(), getEncryptionKey());
      const now = new Date().toISOString();
      db.run(`UPDATE llm_providers SET api_key_ciphertext = ?, updated_at = ? WHERE id = ?`, [
        ciphertext,
        now,
        providerId,
      ]);
    } finally {
      db.close();
    }
  }

  static getKeysStatus(): Record<string, { hasKey: boolean; masked: string }> {
    const db = new Database(CONFIG.DB_PATH, { readonly: true });
    const status: Record<string, { hasKey: boolean; masked: string }> = {};
    try {
      const providers = db
        .query(`SELECT id, key_env_name, api_key_ciphertext FROM llm_providers WHERE is_active = 1`)
        .all() as Array<{ id: string; key_env_name: string; api_key_ciphertext: string | null }>;

      for (const p of providers) {
        const hasCiphertext = Boolean(p.api_key_ciphertext);
        const legacy = readEnvKey(p.key_env_name);
        const hasKey = hasCiphertext || Boolean(legacy);
        status[p.id] = {
          hasKey,
          masked: hasCiphertext
            ? '•••••••• (vault)'
            : legacy.length > 8
              ? `${legacy.slice(0, 5)}...${legacy.slice(-4)}`
              : legacy
                ? '••••••••'
                : '',
        };
      }
    } finally {
      db.close();
    }
    return status;
  }
}
