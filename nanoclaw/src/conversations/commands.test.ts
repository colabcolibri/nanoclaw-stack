import { describe, expect, it } from 'vitest';

import { extractMessageText, isRegisteredSlashCommand, parseSlashCommand, unregisteredSlashToken } from '../commands/parse.js';

describe('conversation commands', () => {
  it('parseConversationCommand recognizes universal commands', () => {
    expect(parseSlashCommand('/clear')).toEqual({ id: 'clear', token: '/clear' });
    expect(parseSlashCommand('/new')).toEqual({ id: 'new', token: '/new' });
    expect(parseSlashCommand('/new-resume')).toEqual({ id: 'new-resume', token: '/new-resume' });
    expect(parseSlashCommand('/new-resume extra')).toEqual({ id: 'new-resume', token: '/new-resume' });
    expect(parseSlashCommand('/new_resume')).toEqual({ id: 'new-resume', token: '/new_resume' });
    expect(parseSlashCommand('/new_resume@barao_bot')).toEqual({ id: 'new-resume', token: '/new_resume' });
    expect(parseSlashCommand('/new@barao_bot')).toEqual({ id: 'new', token: '/new' });
    expect(parseSlashCommand(JSON.stringify({ text: '/new@barao_bot' }))).toEqual({ id: 'new', token: '/new' });
    expect(parseSlashCommand(JSON.stringify({ markdown: '/new@barao_bot' }))).toEqual({ id: 'new', token: '/new' });
  });

  it('parseConversationCommand ignores non-commands', () => {
    expect(parseSlashCommand('hello')).toBeNull();
    expect(parseSlashCommand('/unknown')).toBeNull();
  });

  it('extractMessageText parses JSON inbound', () => {
    expect(extractMessageText(JSON.stringify({ text: '/new' }))).toBe('/new');
    expect(extractMessageText(JSON.stringify({ markdown: '/new@barao_bot' }))).toBe('/new@barao_bot');
    expect(extractMessageText({ markdown: '/clear' })).toBe('/clear');
  });

  it('isConversationCommand', () => {
    expect(isRegisteredSlashCommand('/clear')).toBe(true);
    expect(isRegisteredSlashCommand('hi')).toBe(false);
  });

  it('unregisteredSlashToken flags unknown slash commands', () => {
    expect(unregisteredSlashToken('/unknown')).toBe('/unknown');
    expect(unregisteredSlashToken('/new_resume')).toBeNull();
    expect(unregisteredSlashToken('hello')).toBeNull();
  });
});
