import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import path from 'path';

const BASE = '/tmp/nanoclaw-memory-hook-test';

function runHook(input: string): { exitCode: number; stdout: string } {
  const inputFile = path.join(BASE, 'hook-input.json');
  fs.writeFileSync(inputFile, input);
  // Bun types mark the captured streams optional on this overload (stdin as a
  // file); the hook never inherits stdio, so narrow once at the boundary.
  const proc = Bun.spawnSync(['bun', path.join(import.meta.dir, 'hook.ts'), BASE], {
    stdin: Bun.file(inputFile),
  });
  return { exitCode: proc.exitCode, stdout: proc.stdout?.toString() ?? '' };
}

beforeEach(() => {
  fs.rmSync(BASE, { recursive: true, force: true });
  fs.mkdirSync(path.join(BASE, 'memory', 'system'), { recursive: true });
  fs.writeFileSync(path.join(BASE, 'memory', 'index.md'), '# Memory Index\n');
  fs.writeFileSync(path.join(BASE, 'memory', 'system', 'definition.md'), '# Definition\n');
});

afterEach(() => fs.rmSync(BASE, { recursive: true, force: true }));

describe('memory-hook script', () => {
  it('prints live memory for a new context', () => {
    const proc = runHook(JSON.stringify({ source: 'startup' }));

    expect(proc.exitCode).toBe(0);
    expect(proc.stdout).toContain('## Memory');
  });

  it('prints nothing for resume', () => {
    const proc = runHook(JSON.stringify({ source: 'resume' }));

    expect(proc.exitCode).toBe(0);
    expect(proc.stdout).toBe('');
  });

  it('fails closed for missing or malformed source input', () => {
    expect(runHook('{}').stdout).toBe('');
    expect(runHook('{not-json').stdout).toBe('');
  });
});
