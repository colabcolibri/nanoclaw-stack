import { describe, expect, test } from 'bun:test';
import {
  pickDefaultModelForRole,
  resolveRoleModels,
  resolveWorkerModel,
  type RoleModelRegistry,
} from '../src/services/role-models.js';

const registry: RoleModelRegistry = {
  providers: {
    groq: {
      defaultModel: 'openai/gpt-oss-20b',
      models: [
        { id: 'openai/gpt-oss-20b', recommended: true, recommendedRole: 'orchestrator' },
        { id: 'llama-3.3-70b-versatile', recommendedRole: 'worker' },
        { id: 'openai/gpt-oss-120b', recommendedRole: 'sender' },
        { id: 'llama-3.1-8b-instant', recommended: true, recommendedRole: 'memo' },
      ],
    },
    deepseek: {
      defaultModel: 'deepseek-chat',
      models: [{ id: 'deepseek-chat', recommended: true, recommendedRole: 'all' }],
    },
  },
  modelsById: {
    'openai/gpt-oss-20b': { providerId: 'groq' },
    'llama-3.3-70b-versatile': { providerId: 'groq' },
    'openai/gpt-oss-120b': { providerId: 'groq' },
    'llama-3.1-8b-instant': { providerId: 'groq' },
    'deepseek-chat': { providerId: 'deepseek' },
  },
};

describe('role-models', () => {
  test('empty overrides resolve to catalog defaults per role', () => {
    const resolved = resolveRoleModels('groq', registry, {
      model: '',
      orchestratorModel: '',
      senderModel: '',
      memoModel: '',
    });
    expect(resolved).toEqual({
      model: 'llama-3.3-70b-versatile',
      orchestratorModel: 'openai/gpt-oss-20b',
      senderModel: 'openai/gpt-oss-120b',
      memoModel: 'llama-3.1-8b-instant',
    });
  });

  test('explicit override kept when provider matches', () => {
    const resolved = resolveRoleModels('groq', registry, {
      model: 'openai/gpt-oss-20b',
      orchestratorModel: '',
      senderModel: '',
      memoModel: '',
    });
    expect(resolved?.model).toBe('openai/gpt-oss-20b');
    expect(resolved?.orchestratorModel).toBe('openai/gpt-oss-20b');
  });

  test('mismatched model realigns to role default', () => {
    const resolved = resolveRoleModels('groq', registry, {
      model: 'deepseek-chat',
      orchestratorModel: 'deepseek-chat',
      senderModel: 'deepseek-chat',
      memoModel: 'deepseek-chat',
    });
    expect(resolved?.model).toBe('llama-3.3-70b-versatile');
    expect(resolved?.orchestratorModel).toBe('openai/gpt-oss-20b');
  });

  test('pickDefaultModelForRole falls back to provider defaultModel', () => {
    expect(pickDefaultModelForRole('groq', 'sender', registry)).toBe('openai/gpt-oss-120b');
  });

  test('resolveWorkerModel uses group default unless agent override', () => {
    expect(resolveWorkerModel('llama-3.3-70b-versatile', undefined)).toBe('llama-3.3-70b-versatile');
    expect(resolveWorkerModel('llama-3.3-70b-versatile', 'openai/gpt-oss-20b')).toBe('openai/gpt-oss-20b');
    expect(resolveWorkerModel(undefined, 'openai/gpt-oss-20b')).toBe('openai/gpt-oss-20b');
  });
});
