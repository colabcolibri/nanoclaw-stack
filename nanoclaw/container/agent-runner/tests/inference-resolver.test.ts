import { describe, expect, test } from 'bun:test';
import {
  parseRoleInferenceOverridesJson,
  purposeToLlmRole,
  resolveCallInferenceParams,
} from '../src/services/inference-resolver.js';
import { ModelRegistry } from '../src/services/model-registry.js';

describe('inference-resolver', () => {
  test('purposeToLlmRole maps known purposes', () => {
    expect(purposeToLlmRole('semantic_memo')).toBe('memo');
    expect(purposeToLlmRole('orchestrator_triage')).toBe('orchestrator');
    expect(purposeToLlmRole('stage2_synthesis')).toBe('sender');
    expect(purposeToLlmRole('stage1_action')).toBe('worker');
  });

  test('parseRoleInferenceOverridesJson ignores invalid JSON', () => {
    expect(parseRoleInferenceOverridesJson('not-json')).toEqual({});
  });

  test('resolveCallInferenceParams merges catalog, role and purpose layers', () => {
    ModelRegistry.seedForTests([
      {
        id: 'test-model',
        name: 'Test',
        providerId: 'groq',
        description: '',
        pricing: { cacheHitPerMillion: 0, cacheMissPerMillion: 0, outputPerMillion: 0 },
        contextWindow: '128k',
        completionUrl: 'http://localhost/v1/chat/completions',
        keyEnvName: 'GROQ_API_KEY',
        protocol: 'openai-compatible',
        inferenceParams: { temperature: 0.7, maxTokens: 4096 },
      },
    ]);

    const resolved = resolveCallInferenceParams({
      modelId: 'test-model',
      purpose: 'semantic_memo',
      roleOverrides: { memo: { temperature: 0.5 } },
      callOverride: { maxTokens: 128 },
    });

    expect(resolved.temperature).toBe(0.5);
    expect(resolved.maxTokens).toBe(128);

    ModelRegistry.resetForTests();
  });
});
