import { describe, it, expect } from 'bun:test';

import { createProvider, type ProviderName } from './factory.js';
import { ClaudeProvider } from './claude.js';
import { GroqProvider } from './groq.js';
import { DeepSeekProvider } from './deepseek.js';
import { MockProvider } from './mock.js';

describe('createProvider', () => {
  it('returns ClaudeProvider for claude', () => {
    expect(createProvider('claude')).toBeInstanceOf(ClaudeProvider);
  });

  it('returns GroqProvider for groq', () => {
    expect(createProvider('groq')).toBeInstanceOf(GroqProvider);
  });

  it('returns DeepSeekProvider for deepseek', () => {
    expect(createProvider('deepseek')).toBeInstanceOf(DeepSeekProvider);
  });

  it('returns MockProvider for mock', () => {
    expect(createProvider('mock')).toBeInstanceOf(MockProvider);
  });

  it('throws for unknown name', () => {
    expect(() => createProvider('bogus' as ProviderName)).toThrow(/Unknown provider/);
  });
});
