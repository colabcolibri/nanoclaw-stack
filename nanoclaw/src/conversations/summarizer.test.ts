import { describe, expect, it, vi } from 'vitest';

import { buildExtractiveSummary, summarizeConversation } from './summarizer.js';

describe('conversation summarizer', () => {
  it('buildExtractiveSummary truncates long transcripts', () => {
    const messages = Array.from({ length: 50 }, (_, i) => ({
      role: 'user' as const,
      text: `message number ${i} with some content`,
      timestamp: new Date().toISOString(),
    }));
    const summary = buildExtractiveSummary(messages);
    expect(summary.length).toBeLessThanOrEqual(2000);
    expect(summary).toContain('User:');
  });

  it('summarizeConversation throws when LLM fails', async () => {
    const summarizeWithLlm = vi.fn().mockRejectedValue(new Error('provider offline'));
    await expect(
      summarizeConversation([{ role: 'user', text: 'oi', timestamp: new Date().toISOString() }], summarizeWithLlm),
    ).rejects.toThrow(/Failed to summarize conversation with LLM/);
  });

  it('summarizeConversation throws when LLM returns empty', async () => {
    const summarizeWithLlm = vi.fn().mockResolvedValue('   ');
    await expect(
      summarizeConversation([{ role: 'user', text: 'oi', timestamp: new Date().toISOString() }], summarizeWithLlm),
    ).rejects.toThrow(/resumo vazio/);
  });
});
