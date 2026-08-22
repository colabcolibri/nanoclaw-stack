import { readEnvFile } from '../env.js';
import { getAllLlmProviders } from '../db/llm-models.js';
import { getDb } from '../db/connection.js';
import { decryptSecret, encryptSecret, getCredentialsEncryptionKey } from './crypto.js';

/** Persist API key encrypted in llm_providers. Host/UI only. */
export function setLlmProviderApiKey(providerId: string, plaintext: string): void {
  const key = getCredentialsEncryptionKey();
  if (!key) {
    throw new Error(
      'NANOCLAW_CREDENTIALS_ENCRYPTION_KEY não configurada no host. Defina no .env do NanoClaw (nunca no container).',
    );
  }
  const ciphertext = encryptSecret(plaintext.trim(), key);
  const now = new Date().toISOString();
  getDb()
    .prepare(`UPDATE llm_providers SET api_key_ciphertext = ?, updated_at = ? WHERE id = ?`)
    .run(ciphertext, now, providerId);
}

/** Whether a provider has a stored ciphertext or legacy .env key. */
export function providerHasApiKey(providerId: string, keyEnvName: string): boolean {
  const row = getDb()
    .prepare(`SELECT api_key_ciphertext FROM llm_providers WHERE id = ?`)
    .get(providerId) as { api_key_ciphertext: string | null } | undefined;
  if (row?.api_key_ciphertext) return true;
  const env = readEnvFile([keyEnvName]);
  return Boolean(env[keyEnvName]?.trim());
}

/** Masked status for UI — never returns plaintext. */
export function getLlmProviderKeysStatus(): Record<string, { hasKey: boolean; masked: string }> {
  const providers = getAllLlmProviders(true);
  const status: Record<string, { hasKey: boolean; masked: string }> = {};

  for (const p of providers) {
    const hasCiphertext = Boolean(p.api_key_ciphertext);
    const env = readEnvFile([p.key_env_name]);
    const legacy = env[p.key_env_name]?.trim() || '';
    const hasKey = hasCiphertext || Boolean(legacy);
    status[p.id] = {
      hasKey,
      masked: hasCiphertext ? '•••••••• (vault)' : legacy.length > 8 ? `${legacy.slice(0, 5)}...${legacy.slice(-4)}` : legacy ? '••••••••' : '',
    };
  }
  return status;
}

/**
 * Build env vars for container spawn. Decrypts on host; agent receives plaintext
 * per provider key_env_name but NEVER the encryption master key.
 */
export function buildLlmProviderEnvForContainer(): Record<string, string> {
  const providers = getAllLlmProviders(true);
  const env: Record<string, string> = {};
  const masterKey = getCredentialsEncryptionKey();
  const dotenvCache: Record<string, string> = {};

  for (const p of providers) {
    let value: string | null = null;

    if (p.api_key_ciphertext && masterKey) {
      try {
        value = decryptSecret(p.api_key_ciphertext, masterKey);
      } catch {
        // skip broken ciphertext
      }
    }

    if (!value) {
      if (!dotenvCache[p.key_env_name]) {
        const file = readEnvFile([p.key_env_name]);
        dotenvCache[p.key_env_name] = file[p.key_env_name] || '';
      }
      value = dotenvCache[p.key_env_name] || null;
    }

    if (value?.trim()) {
      env[p.key_env_name] = value.trim();
    }
  }

  return env;
}

/** Env vars de um único provider para o spawn do container. */
export function buildLlmProviderEnvForProvider(providerId: string): Record<string, string> {
  const provider = getAllLlmProviders(true).find((p) => p.id === providerId);
  if (!provider) return {};

  const all = buildLlmProviderEnvForContainer();
  const key = provider.key_env_name;
  const value = all[key];
  return value ? { [key]: value } : {};
}
