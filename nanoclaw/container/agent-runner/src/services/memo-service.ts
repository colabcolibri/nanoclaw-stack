import { getInboundDb, getOutboundDb } from '../db/connection.js';
import { PromptLoader } from './prompt-loader.js';
import { ResponseParser } from '../orchestrator/parser.js';

export interface MessageMemoEntry {
  id: string;
  role: 'user' | 'assistant';
  timestamp: string;
  memo: string;
  charCountOriginal: number;
}

/**
 * MemoService (SRP):
 * Manages conversational memos (up to 300 chars) stored in messages_in and messages_out.
 * Feeds lean contextual indices to the agent and provides on-demand retrieval of full message text.
 */
export class MemoService {
  static readonly MAX_MEMO_CHARS = 300;

  /**
   * Generates a clean excerpt or fallback memo of up to 300 characters.
   */
  static extractMemo(content: string): string {
    if (!content || !content.trim()) return '(vazio)';

    let text = content.trim();
    try {
      const parsed = JSON.parse(text);
      text = parsed.text || parsed.content || parsed.message || text;
    } catch {}

    const cleaned = text
      .replace(/<message\s+to="[^"]*">/gi, '')
      .replace(/<\/message>/gi, '')
      .replace(/#+\s+/g, '')
      .replace(/[*_`~]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.length <= this.MAX_MEMO_CHARS) {
      return cleaned;
    }

    return `${cleaned.slice(0, this.MAX_MEMO_CHARS - 3)}...`;
  }

  /**
   * Generates an intelligent, semantic summary for any text longer than 300 characters
   * using a direct English summarization prompt.
   * If text is already <= 300 characters, returns the clean text directly without calling the LLM.
   */
  static async generateSemanticMemo(
    content: string,
    completeFn?: (system: string, user: string) => Promise<string>
  ): Promise<string> {
    if (!content || !content.trim()) return '(vazio)';

    let text = content.trim();
    try {
      const parsed = JSON.parse(text);
      text = parsed.text || parsed.content || parsed.message || text;
    } catch {}

    const cleaned = text
      .replace(/<message\s+to="[^"]*">/gi, '')
      .replace(/<\/message>/gi, '')
      .replace(/#+\s+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Fast-path: If already within the limit, text itself is the optimal memo
    if (cleaned.length <= this.MAX_MEMO_CHARS) {
      return cleaned;
    }

    // If an LLM completion function is provided, generate a dense 1-2 sentence semantic summary
    if (completeFn) {
      try {
        const summarizePrompt = PromptLoader.load('memo.summarize', {
          fallback:
            'You are an ultra-concise conversational memo generator.\nSummarize the core intent, essential facts, actions, and decisions into 1 or 2 dense, direct sentences.\nSTRICT REQUIREMENT: Maximum 280 characters. Output ONLY the summary text.',
        });

        const rawSummary = await completeFn(summarizePrompt, `Text to summarize:\n${cleaned}`);
        const parsed = ResponseParser.cleanHumanText(rawSummary) || rawSummary;
        const cleanSummary = parsed
          .replace(/<message\s+to="[^"]*">/gi, '')
          .replace(/<\/message>/gi, '')
          .replace(/^"|"$/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (cleanSummary.length > 0) {
          return cleanSummary.length <= this.MAX_MEMO_CHARS
            ? cleanSummary
            : `${cleanSummary.slice(0, this.MAX_MEMO_CHARS - 3)}...`;
        }
      } catch (err) {
        console.error('[MemoService] Semantic summarization error, falling back to clean excerpt:', err);
      }
    }

    return `${cleaned.slice(0, this.MAX_MEMO_CHARS - 3)}...`;
  }

  /**
   * Updates the memo of an outbound message in SQLite.
   */
  static updateOutboundMemo(messageId: string, memo: string): void {
    try {
      getOutboundDb().prepare('UPDATE messages_out SET memo = ? WHERE id = ?').run(memo, messageId);
    } catch {}
  }

  /**
   * Updates the memo of an inbound message in SQLite.
   */
  static updateInboundMemo(messageId: string, memo: string): void {
    try {
      getInboundDb().prepare('UPDATE messages_in SET memo = ? WHERE id = ?').run(memo, messageId);
    } catch {}
  }

  /**
   * Retrieves recent memos across inbound and outbound messages.
   */
  static getRecentMemos(limit = 6): MessageMemoEntry[] {
    const list: MessageMemoEntry[] = [];

    try {
      const inbound = getInboundDb();
      const inRows = inbound
        .prepare('SELECT id, timestamp, content, memo FROM messages_in ORDER BY rowid DESC LIMIT ?')
        .all(limit) as Array<{ id: string; timestamp: string; content: string; memo?: string | null }>;

      for (const r of inRows) {
        list.push({
          id: r.id,
          role: 'user',
          timestamp: r.timestamp,
          memo: r.memo || this.extractMemo(r.content),
          charCountOriginal: r.content.length,
        });
      }
    } catch {}

    try {
      const outbound = getOutboundDb();
      const outRows = outbound
        .prepare('SELECT id, timestamp, content, memo FROM messages_out ORDER BY rowid DESC LIMIT ?')
        .all(limit) as Array<{ id: string; timestamp: string; content: string; memo?: string | null }>;

      for (const r of outRows) {
        list.push({
          id: r.id,
          role: 'assistant',
          timestamp: r.timestamp,
          memo: r.memo || this.extractMemo(r.content),
          charCountOriginal: r.content.length,
        });
      }
    } catch {}

    // Sort chronologically ascending for the prompt
    list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return list.slice(-limit);
  }

  /**
   * Retrieves the full original text of a message by ID.
   */
  static getFullMessage(messageId: string): string | null {
    try {
      const inRow = getInboundDb().prepare('SELECT content FROM messages_in WHERE id = ?').get(messageId) as
        | { content: string }
        | undefined;
      if (inRow) {
        try {
          const parsed = JSON.parse(inRow.content);
          return parsed.text || inRow.content;
        } catch {
          return inRow.content;
        }
      }
    } catch {}

    try {
      const outRow = getOutboundDb().prepare('SELECT content FROM messages_out WHERE id = ?').get(messageId) as
        | { content: string }
        | undefined;
      if (outRow) {
        try {
          const parsed = JSON.parse(outRow.content);
          return parsed.text || outRow.content;
        } catch {
          return outRow.content;
        }
      }
    } catch {}

    return null;
  }
}
