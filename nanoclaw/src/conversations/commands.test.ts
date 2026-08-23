import { describe, expect, it } from 'vitest';

import { extractMessageText, isRegisteredSlashCommand, parseSlashCommand } from '../commands/parse.js';

describe('conversation commands', () => {
  it('parseConversationCommand recognizes universal commands', () => {
    expect(parseSlashCommand('/clear')).toEqual({ id: 'clear', token: '/clear' });
    expect(parseSlashCommand('/new')).toEqual({ id: 'new', token: '/new' });
    expect(parseSlashCommand('/new-resume')).toEqual({ id: 'new-resume', token: '/new-resume' });
    expect(parseSlashCommand('/new-resume extra')).toEqual({ id: 'new-resume', token: '/new-resume' });
  });

  it('parseConversationCommand ignores non-commands', () => {
    expect(parseSlashCommand('hello')).toBeNull();
    expect(parseSlashCommand('/unknown')).toBeNull();
  });

  it('extractMessageText parses JSON inbound', () => {
    expect(extractMessageText(JSON.stringify({ text: '/new' }))).toBe('/new');
  });

  it('isConversationCommand', () => {
    expect(isRegisteredSlashCommand('/clear')).toBe(true);
    expect(isRegisteredSlashCommand('hi')).toBe(false);
  });
});
