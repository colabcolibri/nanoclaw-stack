import { describe, expect, it } from 'vitest';

import { pickDefaultSessionId, resolveSelectedSessionId } from './thread-selection.js';

const threads = [
  { sessionId: 'sess-archived', status: 'archived' as const },
  { sessionId: 'sess-active', status: 'active' as const },
];

describe('thread-selection', () => {
  it('pickDefaultSessionId prefers active session', () => {
    expect(pickDefaultSessionId(threads)).toBe('sess-active');
  });

  it('pickDefaultSessionId falls back to first when none active', () => {
    expect(pickDefaultSessionId([{ sessionId: 'sess-only', status: 'archived' }])).toBe('sess-only');
  });

  it('resolveSelectedSessionId keeps active selection', () => {
    expect(resolveSelectedSessionId(threads, 'sess-active')).toBe('sess-active');
  });

  it('resolveSelectedSessionId moves away from archived selection', () => {
    expect(resolveSelectedSessionId(threads, 'sess-archived')).toBe('sess-active');
  });

  it('resolveSelectedSessionId picks default when selection missing', () => {
    expect(resolveSelectedSessionId(threads, 'sess-unknown')).toBe('sess-active');
    expect(resolveSelectedSessionId(threads, null)).toBe('sess-active');
  });
});
