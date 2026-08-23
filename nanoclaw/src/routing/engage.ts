import { isRegisteredSlashCommand } from '../commands/parse.js';

/** Host-registered slash commands always engage — bypass mention/pattern gates. */
export function shouldForceEngageForHostSlash(messageKind: string, content: string): boolean {
  return (messageKind === 'chat' || messageKind === 'chat-sdk') && isRegisteredSlashCommand(content);
}
