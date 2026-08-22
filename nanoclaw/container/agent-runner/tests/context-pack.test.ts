import { describe, expect, test } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ContextPack } from '../src/services/context-pack.js';
import { CONTEXT_FILE, PersonaLoader, SOUL_FILE } from '../src/services/persona-loader.js';

describe('ContextPack', () => {
  test('fast path returns empty memos when orchestrator did not select ids', () => {
    const memos = ContextPack.resolveMemos({ memoIds: [] }, true);
    expect(memos).toEqual([]);
  });

  test('synthesis without ids falls back to recent memos slice', () => {
    const memos = ContextPack.resolveMemos({ memoIds: [] }, false);
    expect(Array.isArray(memos)).toBe(true);
  });
});

describe('PersonaLoader', () => {
  test('compact mode loads only SOUL file', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-soul-'));
    const soul = '# SOUL\nVocê é o Barão, mineiro sarcástico.';
    const context = '# Contexto\nRegras de módulos e ferramentas.';
    fs.writeFileSync(path.join(tmp, SOUL_FILE), soul);
    fs.writeFileSync(path.join(tmp, CONTEXT_FILE), context);

    expect(PersonaLoader.resolveForSender(tmp, undefined, 'compact')).toBe(soul);
  });

  test('full mode loads SOUL plus context file', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-soul-'));
    const soul = '# SOUL\nVocê é o Barão.';
    const context = 'Diretrizes operacionais estendidas.';
    fs.writeFileSync(path.join(tmp, SOUL_FILE), soul);
    fs.writeFileSync(path.join(tmp, CONTEXT_FILE), context);

    const resolved = PersonaLoader.resolveForSender(tmp, undefined, 'full');
    expect(resolved).toContain('Barão');
    expect(resolved).toContain('operacionais estendidas');
  });

  test('falls back to injected soul when file is missing', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-soul-'));
    const injected = 'Você é o Barão: Mineiro Sarcástico e refinado.';
    expect(PersonaLoader.resolveForSender(tmp, injected, 'compact')).toBe(injected);
  });
});
