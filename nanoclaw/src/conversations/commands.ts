/**
 * @deprecated Import from `../commands/parse.js` instead.
 */
export { parseConversationCommand, isConversationCommand, extractMessageText } from '../commands/parse.js';

import type { ConversationCommandName } from './types.js';

/** @deprecated Use parseSlashCommand from commands module */
export const CONVERSATION_COMMAND_NAMES = ['/clear', '/new', '/new-resume'];

export type { ConversationCommandName };
