export type {
  CommandExecutionContext,
  CommandExecutionResult,
  CommandReplyPersist,
  ParsedSlashCommand,
  SlashCommandDefinition,
  SlashCommandResult,
} from './types.js';
export {
  getAdminSlashTokens,
  getSlashCommandById,
  getSlashCommandByToken,
  getSlashCommandDefinitions,
  getTelegramBotCommands,
} from './registry.js';
export { extractMessageText, isRegisteredSlashCommand, parseSlashCommand } from './parse.js';
export { deliverCommandReply, resolvePersistSessionId } from './deliver-reply.js';
export { executeSlashCommand } from './execute.js';

// Back-compat aliases for conversation module consumers
export { parseSlashCommand as parseConversationCommand } from './parse.js';
export { isRegisteredSlashCommand as isConversationCommand } from './parse.js';
export { executeSlashCommand as executeConversationCommand } from './execute.js';
