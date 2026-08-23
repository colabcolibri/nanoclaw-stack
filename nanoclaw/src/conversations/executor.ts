/**
 * @deprecated Import from `../commands/index.js` instead.
 * Thin re-export layer kept for existing imports.
 */
export {
  executeConversationCommand,
  isConversationCommand,
  parseConversationCommand,
  type ConversationCommandResult,
} from '../commands/index.js';

export type { SlashCommandResult as ConversationCommandResult } from '../commands/types.js';
