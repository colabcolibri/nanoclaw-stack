import { getConversationBackend } from '../conversations/backend.js';
import type { Session } from '../types.js';
import type { DeliveryAddress } from '../conversations/types.js';
import type { CommandReplyPersist } from './types.js';

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
  getConversationBackend().writeCommandAck(agentGroupId, sessionId, delivery, text);
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
