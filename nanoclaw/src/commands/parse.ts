import { getSlashCommandByToken } from './registry.js';
import type { ParsedSlashCommand } from './types.js';

/** Extract message text from inbound JSON content or raw string. */
export function extractMessageText(content: string): string {
  try {
    const parsed = JSON.parse(content) as { text?: string };
    return (parsed.text ?? '').trim();
  } catch {
    return content.trim();
  }
}

/** Parse a universal slash command from inbound message text. */
export function parseSlashCommand(content: string): ParsedSlashCommand | null {
  const text = extractMessageText(content);
  if (!text.startsWith('/')) return null;
  const token = text.split(/\s+/)[0]?.toLowerCase();
  if (!token) return null;
  const def = getSlashCommandByToken(token);
  if (!def) return null;
  return { id: def.id, token };
}

export function isRegisteredSlashCommand(content: string): boolean {
  return parseSlashCommand(content) !== null;
}
