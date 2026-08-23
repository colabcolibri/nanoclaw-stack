import { writeOutboundDirect } from '../session-manager.js';
import type { Session } from '../types.js';
import type { DeliveryAddress } from '../conversations/types.js';
import type { CommandReplyPersist } from './types.js';

function replyId(): string {
  return `cmd-ack-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Deliver a command acknowledgement to the platform and optionally persist it
 * in the session DB (thread history).
 */
export function deliverCommandReply(
  agentGroupId: string,
  sessionId: string,
  delivery: DeliveryAddress,
  text: string,
  persist: CommandReplyPersist,
): void {
  if (persist === 'ephemeral') return;

  writeOutboundDirect(agentGroupId, sessionId, {
    id: replyId(),
    kind: 'chat',
    platformId: delivery.platformId,
    channelType: delivery.channelType,
    threadId: delivery.threadId,
    content: JSON.stringify({
      text,
      sender: 'system',
      command_ack: true,
      ephemeral: false,
    }),
  });
}

/** Resolve which session row should receive a persisted ack. */
export function resolvePersistSessionId(
  persist: CommandReplyPersist,
  currentSession: Session,
  resultSession: Session,
): string | null {
  switch (persist) {
    case 'ephemeral':
      return null;
    case 'current_session':
      return currentSession.id;
    case 'result_session':
      return resultSession.id;
    default:
      return null;
  }
}
