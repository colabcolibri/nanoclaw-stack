import type { ConversationMessage, SummarizeMessagesFn } from './types.js';

const MAX_SUMMARY_CHARS = 2000;

/** Deterministic extractive summary — always available without LLM. */
export function buildExtractiveSummary(messages: ConversationMessage[]): string {
  const lines: string[] = [];
  for (const msg of messages) {
    const prefix = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System';
    const text = msg.text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    lines.push(`${prefix}: ${text}`);
  }
  const joined = lines.join('\n');
  if (joined.length <= MAX_SUMMARY_CHARS) return joined;
  return `${joined.slice(0, MAX_SUMMARY_CHARS - 3)}...`;
}

const LLM_SUMMARY_SYSTEM = `You summarize a conversation for handoff to a new session.
Output ONLY the summary (no preamble). Include: key facts, decisions, open tasks, preferences.
Maximum ${MAX_SUMMARY_CHARS} characters. Use the same language as the conversation.`;

/** Summarize with optional LLM; falls back to extractive summary. */
export async function summarizeConversation(
  messages: ConversationMessage[],
  summarizeWithLlm?: SummarizeMessagesFn,
): Promise<string> {
  const relevant = messages.filter((m) => m.text.trim().length > 0);
  if (relevant.length === 0) {
    return 'No prior messages in this conversation.';
  }

  if (summarizeWithLlm) {
    try {
      const summary = await summarizeWithLlm(relevant);
      if (summary.trim()) {
        return summary.trim().slice(0, MAX_SUMMARY_CHARS);
      }
    } catch {
      /* fallback */
    }
  }

  return buildExtractiveSummary(relevant);
}

/** Build LLM summarize fn from an OpenAI-compatible completion function. */
export function createLlmSummarizeFn(
  completeFn: (messages: { role: string; content: string }[]) => Promise<{ content?: string }>,
): SummarizeMessagesFn {
  return async (messages) => {
    const transcript = messages
      .map((m) => `${m.role}: ${m.text}`)
      .join('\n')
      .slice(0, 12000);
    const result = await completeFn([
      { role: 'system', content: LLM_SUMMARY_SYSTEM },
      { role: 'user', content: transcript },
    ]);
    return result.content?.trim() ?? buildExtractiveSummary(messages);
  };
}
