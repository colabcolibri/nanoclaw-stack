import { describe, expect, it } from 'vitest';

import { parseSlashCommand } from './parse.js';
import { getTelegramBotCommands, getSlashCommandById } from './registry.js';

describe('slash command registry', () => {
  it('parses registered commands', () => {
    expect(parseSlashCommand('/clear')?.id).toBe('clear');
    expect(parseSlashCommand('/new')?.id).toBe('new');
    expect(parseSlashCommand('/new-resume')?.id).toBe('new-resume');
  });

  it('defines persist policy per command', () => {
    expect(getSlashCommandById('clear')).toBeDefined();
    expect(getSlashCommandById('new')).toBeDefined();
  });

  it('exports telegram menu from same registry', () => {
    const tg = getTelegramBotCommands();
    expect(tg.some((c) => c.command === 'new')).toBe(true);
    expect(tg.every((c) => !c.command.startsWith('/'))).toBe(true);
  });
});
