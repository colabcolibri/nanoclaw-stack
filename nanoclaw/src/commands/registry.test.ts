import { describe, expect, it } from 'vitest';

import { parseSlashCommand } from './parse.js';
import { getTelegramBotCommands, getSlashCommandById, slashAliases } from './registry.js';

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
    expect(tg.some((c) => c.command === 'new_resume')).toBe(true);
    expect(tg.every((c) => !c.command.startsWith('/'))).toBe(true);
    expect(tg.every((c) => /^[a-z0-9_]{1,32}$/.test(c.command))).toBe(true);
  });

  it('parses telegram underscore alias for new-resume', () => {
    expect(parseSlashCommand('/new_resume')?.id).toBe('new-resume');
  });

  it('derives telegram-safe slash aliases from canonical ids', () => {
    expect(slashAliases('new')).toEqual(['/new']);
    expect(slashAliases('new-resume')).toEqual(['/new-resume', '/new_resume']);
  });
});
