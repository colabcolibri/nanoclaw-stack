import fs from 'fs';

import { openInboundDb, openOutboundDb } from '../db/session-db.js';
import { inboundDbPath, outboundDbPath } from '../session-manager.js';
import { getHistoryCutoff } from './session-state.js';
import type { ConversationMessage } from './types.js';

function parseContentText(raw: string, role: 'user' | 'assistant'): string {
  if (role === 'assistant') {
    return raw
      .replace(/<message[^>]*>/gi, '')
      .replace(/<\/message>/gi, '')
      .trim();
  }
  try {
    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw) as { text?: string; content?: string };
      return (parsed.text ?? parsed.content ?? raw).trim();
    }
  } catch {
    /* raw */
  }
  return raw.trim();
}

/** Read chronological conversation messages from session DBs. */
export function readConversationHistory(agentGroupId: string, sessionId: string, limit = 50): ConversationMessage[] {
  const inPath = inboundDbPath(agentGroupId, sessionId);
  const outPath = outboundDbPath(agentGroupId, sessionId);
  if (!fs.existsSync(inPath) && !fs.existsSync(outPath)) return [];

  const cutoff = getHistoryCutoff(agentGroupId, sessionId);
  const cutoffMs = cutoff ? Date.parse(cutoff) : null;

  const combined: ConversationMessage[] = [];

  if (fs.existsSync(inPath)) {
    const db = openInboundDb(inPath);
    try {
      const rows = db.prepare(`SELECT timestamp, content, kind FROM messages_in ORDER BY timestamp ASC`).all() as {
        timestamp: string;
        content: string;
        kind: string;
      }[];
      for (const row of rows) {
        if (row.kind !== 'chat' && row.kind !== 'chat-sdk' && row.kind !== 'system') continue;
        if (cutoffMs !== null && Number.isFinite(cutoffMs) && Date.parse(row.timestamp) <= cutoffMs) continue;
        combined.push({
          role: row.kind === 'system' ? 'system' : 'user',
          text: parseContentText(row.content, 'user'),
          timestamp: row.timestamp,
        });
      }
    } finally {
      db.close();
    }
  }

  if (fs.existsSync(outPath)) {
    const db = openOutboundDb(outPath);
    try {
      const rows = db.prepare(`SELECT timestamp, content FROM messages_out ORDER BY timestamp ASC`).all() as {
        timestamp: string;
        content: string;
      }[];
      for (const row of rows) {
        if (cutoffMs !== null && Number.isFinite(cutoffMs) && Date.parse(row.timestamp) <= cutoffMs) continue;
        combined.push({
          role: 'assistant',
          text: parseContentText(row.content, 'assistant'),
          timestamp: row.timestamp,
        });
      }
    } finally {
      db.close();
    }
  }

  combined.sort((a, b) => {
    const tA = Date.parse(a.timestamp);
    const tB = Date.parse(b.timestamp);
    if (tA !== tB) return tA - tB;
    if (a.role === 'user' && b.role === 'assistant') return -1;
    if (a.role === 'assistant' && b.role === 'user') return 1;
    return 0;
  });

  return combined.slice(-limit);
}
