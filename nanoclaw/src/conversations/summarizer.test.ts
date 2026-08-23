import { describe, expect, it } from 'vitest';

import { buildExtractiveSummary } from './summarizer.js';

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
});
