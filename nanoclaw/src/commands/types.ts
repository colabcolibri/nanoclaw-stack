import type { Session } from '../types.js';
import type { CallerContext, DeliveryAddress, SummarizeMessagesFn } from '../conversations/types.js';

/** Where the command acknowledgement is stored and shown. */
export type CommandReplyPersist =
  /** Deliver to the user on the platform only — not written to session DB / thread history. */
  | 'ephemeral'
  /** Written to the session that was active when the command ran. */
  | 'current_session'
  /** Written to the session produced by the command (e.g. after /new). */
  | 'result_session';

export interface CommandExecutionContext {
  caller: CallerContext;
  delivery: DeliveryAddress;
  summarizeWithLlm?: SummarizeMessagesFn;
}

export interface CommandExecutionResult {
  reply: string;
  session: Session;
  wake: boolean;
  persist: CommandReplyPersist;
}

export interface SlashCommandDefinition {
  /** Canonical id — stable across channels (no slash). */
  id: string;
  /** User-facing slash tokens, lowercase, with leading slash. */
  aliases: string[];
  description: string;
  /** Shown in Telegram command menu (max ~256 chars total per TG limits). */
  telegramDescription?: string;
  category: 'conversation' | 'admin' | 'info';
  requiresAdmin: boolean;
  execute: (ctx: CommandExecutionContext) => Promise<CommandExecutionResult>;
}

export interface ParsedSlashCommand {
  id: string;
  token: string;
}

export interface SlashCommandResult {
  handled: true;
  commandId: string;
  reply: string;
  session: Session;
  wake: boolean;
  persist: CommandReplyPersist;
  ephemeral: boolean;
}
