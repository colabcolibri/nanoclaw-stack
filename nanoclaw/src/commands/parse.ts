import { getSlashCommandByToken } from './registry.js';
import type { ParsedSlashCommand } from './types.js';

type InboundTextPayload = { text?: string; markdown?: string; content?: string };

function readInboundText(payload: InboundTextPayload): string {
  return (payload.text ?? payload.markdown ?? payload.content ?? '').trim();
}

/** Extract message text from inbound JSON content, raw string, or chat-sdk object. */
export function extractMessageText(content: string | InboundTextPayload): string {
  if (typeof content === 'object' && content !== null) {
    return readInboundText(content);
  }
  try {
    const parsed = JSON.parse(content) as InboundTextPayload;
    const fromJson = readInboundText(parsed);
    if (fromJson) return fromJson;
  } catch {
    /* raw string below */
  }
  return content.trim();
}

/** Strip Telegram @botname suffix from a slash token (`/new@barao_bot` → `/new`). */
export function normalizeSlashToken(rawToken: string): string {
  const trimmed = rawToken.trim().toLowerCase();
  const at = trimmed.indexOf('@');
  return at >= 0 ? trimmed.slice(0, at) : trimmed;
}

/** Parse a universal slash command from inbound message text. */
export function parseSlashCommand(content: string | InboundTextPayload): ParsedSlashCommand | null {
  const text = extractMessageText(content);
  if (!text.startsWith('/')) return null;
  const rawToken = text.split(/\s+/)[0];
  if (!rawToken) return null;
  const token = normalizeSlashToken(rawToken);
  const def = getSlashCommandByToken(token);
  if (!def) return null;
  return { id: def.id, token };
}

export function isRegisteredSlashCommand(content: string | InboundTextPayload): boolean {
  return parseSlashCommand(content) !== null;
}
