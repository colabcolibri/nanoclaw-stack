import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function deriveKey(encryptionKey: string): Buffer {
  return crypto.createHash('sha256').update(encryptionKey, 'utf8').digest();
}

/** Encrypt a secret for storage in SQLite. Host-only — never mount the key into agents. */
export function encryptSecret(plaintext: string, encryptionKey: string): string {
  const key = deriveKey(encryptionKey);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/** Decrypt a secret stored by encryptSecret. Host-only. */
export function decryptSecret(ciphertext: string, encryptionKey: string): string {
  const key = deriveKey(encryptionKey);
  const buf = Buffer.from(ciphertext, 'base64');
  if (buf.length < IV_BYTES + AUTH_TAG_BYTES + 1) {
    throw new Error('Invalid ciphertext');
  }
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const data = buf.subarray(IV_BYTES + AUTH_TAG_BYTES);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function getCredentialsEncryptionKey(): string | null {
  const key = process.env.NANOCLAW_CREDENTIALS_ENCRYPTION_KEY?.trim();
  return key || null;
}
