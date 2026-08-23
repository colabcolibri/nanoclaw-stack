/**
 * Unified inbound slash-command pipeline for all transports (channels, sync-turn).
 * gate → parse → execute → deliver (channel) or return reply (sync).
 */
import { gateCommand } from '../command-gate.js';
import { executeSlashCommand, parseSlashCommand, unregisteredSlashToken } from '../commands/index.js';
import type { SlashCommandResult } from '../commands/types.js';
import { buildConversationSummarizeFn } from '../conversations/summarize-factory.js';
import type { CallerContext, DeliveryAddress, SummarizeMessagesFn } from '../conversations/types.js';
import { deliverSessionMessages } from '../delivery.js';
import { log } from '../log.js';
import { writeOutboundDirect } from '../session-manager.js';
import type { Session } from '../types.js';

export type SlashTransport = 'channel' | 'sync';

export interface SlashPipelineInput {
  content: string;
  caller: CallerContext;
  delivery: DeliveryAddress;
  userId: string | null;
  agentGroupId: string;
  transport: SlashTransport;
  /** e.g. conversationMode / reset — runs this command without parsing content. */
  explicitCommandId?: string;
  /** Required for channel deny acks (current session before /new). */
  denySession?: Session;
  summarizeWithLlm?: SummarizeMessagesFn;
}

export type SlashPipelineOutcome =
  | { kind: 'not_slash' }
  | { kind: 'filtered' }
  | { kind: 'denied'; reply: string; session: Session }
  | { kind: 'handled'; result: SlashCommandResult };

function slashAuditFields(
  input: SlashPipelineInput,
  parsed: { id: string; token: string },
  extra?: Record<string, unknown>,
) {
  return {
    command: parsed.id,
    token: parsed.token,
    userId: input.userId,
    agentGroupId: input.agentGroupId,
    messagingGroupId: input.caller.messagingGroupId,
    channelType: input.delivery.channelType,
    platformId: input.delivery.platformId,
    threadId: input.delivery.threadId,
    transport: input.transport,
    ...extra,
  };
}

function resolveCommand(input: SlashPipelineInput) {
  if (input.explicitCommandId) {
    return { id: input.explicitCommandId, token: `/${input.explicitCommandId}` };
  }
  return parseSlashCommand(input.content);
}

/** All transports share the same LLM summarize wiring for /new-resume. */
function resolveSummarizeWithLlm(
  commandId: string,
  caller: CallerContext,
  override?: SummarizeMessagesFn,
): SummarizeMessagesFn | undefined {
  if (commandId !== 'new-resume') return undefined;
  return override ?? buildConversationSummarizeFn(caller.agentGroupId);
}

export async function runSlashPipeline(input: SlashPipelineInput): Promise<SlashPipelineOutcome> {
  const parsed = resolveCommand(input);
  if (!parsed) {
    const unknownToken = unregisteredSlashToken(input.content);
    if (unknownToken) {
      log.warn('Slash command not in host registry — no ack will be sent', {
        token: unknownToken,
        userId: input.userId,
        agentGroupId: input.agentGroupId,
        messagingGroupId: input.caller.messagingGroupId,
        channelType: input.delivery.channelType,
        platformId: input.delivery.platformId,
        threadId: input.delivery.threadId,
        transport: input.transport,
      });
    }
    return { kind: 'not_slash' };
  }

  if (input.transport === 'channel') {
    const gateContent = input.explicitCommandId ? parsed.token : input.content;
    const gate = gateCommand(gateContent, input.userId, input.agentGroupId);
    if (gate.action === 'filter') {
      log.info('Slash command filtered', slashAuditFields(input, parsed));
      return { kind: 'filtered' };
    }
    if (gate.action === 'deny') {
      if (!input.denySession) {
        throw new Error('denySession is required for channel slash deny delivery');
      }
      const reply = `Permissão negada: ${gate.command} requer acesso de administrador.`;
      log.info('Slash command denied', slashAuditFields(input, parsed, { reason: 'admin_required' }));
      writeOutboundDirect(input.denySession.agent_group_id, input.denySession.id, {
        id: `deny-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: 'chat',
        platformId: input.delivery.platformId,
        channelType: input.delivery.channelType,
        threadId: input.delivery.threadId,
        content: JSON.stringify({ text: reply }),
      });
      await deliverSessionMessages(input.denySession);
      return { kind: 'denied', reply, session: input.denySession };
    }
  }

  const summarizeWithLlm = resolveSummarizeWithLlm(parsed.id, input.caller, input.summarizeWithLlm);

  const result = await executeSlashCommand(parsed.id, input.caller, input.delivery, {
    summarizeWithLlm,
  });

  if (input.transport === 'channel') {
    await deliverSessionMessages(result.session);
  }

  log.info(
    'Slash command handled',
    slashAuditFields(input, parsed, {
      sessionId: result.session.id,
      persist: result.persist,
      replyPreview: result.reply.slice(0, 120),
    }),
  );

  return { kind: 'handled', result };
}
