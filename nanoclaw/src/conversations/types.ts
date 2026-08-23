import type { Session } from '../types.js';

/** Caller-agnostic identity for conversation routing. */
export interface CallerContext {
  agentGroupId: string;
  messagingGroupId: string | null;
  threadId: string | null;
  sessionMode: 'shared' | 'per-thread' | 'agent-shared';
  channelType: string;
  platformId: string | null;
  userId: string | null;
}

export interface DeliveryAddress {
  channelType: string;
  platformId: string | null;
  threadId: string | null;
}

export type ConversationCommandName = 'clear' | 'new' | 'new-resume';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
}

export interface ConversationCommandResult {
  handled: true;
  reply: string;
  session: Session;
  /** Wake container after command (e.g. handoff message pending). */
  wake: boolean;
}

export type SummarizeMessagesFn = (messages: ConversationMessage[]) => Promise<string>;

export const HISTORY_CUTOFF_KEY = 'conversation:history_cutoff';
export const HANDOFF_PREFIX = '[Context from previous conversation]';
