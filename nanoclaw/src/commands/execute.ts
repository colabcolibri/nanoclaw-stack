import { resolveActiveSession } from '../conversations/lifecycle.js';
import type { CallerContext, DeliveryAddress, SummarizeMessagesFn } from '../conversations/types.js';
import { deliverCommandReply, resolvePersistSessionId } from './deliver-reply.js';
import { getSlashCommandById } from './registry.js';
import type { SlashCommandResult } from './types.js';

export interface ExecuteSlashCommandOptions {
  summarizeWithLlm?: SummarizeMessagesFn;
}

/**
 * Execute a registered slash command for any caller.
 * The inbound slash message itself is never stored — only the ack (per persist policy).
 */
export async function executeSlashCommand(
  commandId: string,
  caller: CallerContext,
  delivery: DeliveryAddress,
  options: ExecuteSlashCommandOptions = {},
): Promise<SlashCommandResult> {
  const def = getSlashCommandById(commandId);
  if (!def) {
    throw new Error(`Unknown slash command: ${commandId}`);
  }

  const { session: sessionBefore } = resolveActiveSession(caller);
  const result = await def.execute({
    caller,
    delivery,
    summarizeWithLlm: options.summarizeWithLlm,
  });

  const persistSessionId = resolvePersistSessionId(result.persist, sessionBefore, result.session);
  if (persistSessionId) {
    deliverCommandReply(caller.agentGroupId, persistSessionId, delivery, result.reply, result.persist);
  }

  return {
    handled: true,
    commandId: def.id,
    reply: result.reply,
    session: result.session,
    wake: result.wake,
    persist: result.persist,
    ephemeral: result.persist === 'ephemeral',
  };
}
