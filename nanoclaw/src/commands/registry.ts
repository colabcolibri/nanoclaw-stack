import {
  forgetSoft,
  resolveActiveSession,
  startNewConversation,
  startNewConversationWithResume,
} from '../conversations/lifecycle.js';
import type { CommandExecutionContext, CommandExecutionResult, SlashCommandDefinition } from './types.js';

const definitions: SlashCommandDefinition[] = [
  {
    id: 'clear',
    aliases: ['/clear'],
    description: 'Clear LLM context for the current conversation (history kept for audit).',
    telegramDescription: 'Clear model context (keeps audit log)',
    category: 'conversation',
    requiresAdmin: true,
    async execute({ caller }): Promise<CommandExecutionResult> {
      const { session } = resolveActiveSession(caller);
      forgetSoft(caller.agentGroupId, session.id);
      return {
        reply: 'Contexto do modelo limpo. O histórico de auditoria foi mantido.',
        session,
        wake: false,
        persist: 'current_session',
      };
    },
  },
  {
    id: 'new',
    aliases: ['/new'],
    description: 'Start a new conversation (archives the current session).',
    telegramDescription: 'Start a new conversation',
    category: 'conversation',
    requiresAdmin: true,
    async execute({ caller }): Promise<CommandExecutionResult> {
      const { session: current } = resolveActiveSession(caller);
      const next = startNewConversation(caller, current);
      return {
        reply: 'Nova conversa iniciada. A conversa anterior foi arquivada.',
        session: next,
        wake: false,
        persist: 'result_session',
      };
    },
  },
  {
    id: 'new-resume',
    aliases: ['/new-resume'],
    description: 'Start a new conversation with a summary from the previous one.',
    telegramDescription: 'New conversation with prior context',
    category: 'conversation',
    requiresAdmin: true,
    async execute({ caller, summarizeWithLlm }): Promise<CommandExecutionResult> {
      const { session: current } = resolveActiveSession(caller);
      const { session: next } = await startNewConversationWithResume(caller, current, summarizeWithLlm);
      return {
        reply: 'Nova conversa iniciada com resumo da conversa anterior.',
        session: next,
        wake: false,
        persist: 'result_session',
      };
    },
  },
];

const aliasIndex = new Map<string, SlashCommandDefinition>();
for (const def of definitions) {
  for (const alias of def.aliases) {
    aliasIndex.set(alias.toLowerCase(), def);
  }
}

export function getSlashCommandDefinitions(): readonly SlashCommandDefinition[] {
  return definitions;
}

export function getSlashCommandById(id: string): SlashCommandDefinition | undefined {
  return definitions.find((d) => d.id === id);
}

export function getSlashCommandByToken(token: string): SlashCommandDefinition | undefined {
  return aliasIndex.get(token.toLowerCase());
}

export function getAdminSlashTokens(): string[] {
  return definitions.filter((d) => d.requiresAdmin).flatMap((d) => d.aliases);
}

/** Telegram Bot API menu — same ids/aliases as slash commands, without leading slash. */
export function getTelegramBotCommands(): { command: string; description: string }[] {
  return definitions
    .filter((d) => d.telegramDescription)
    .map((d) => ({
      command: d.id,
      description: d.telegramDescription!.slice(0, 256),
    }));
}
