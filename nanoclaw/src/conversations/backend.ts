import type { ConversationBackend } from './backend-types.js';
import { createNodeConversationBackend } from './backend-node.js';

let injectedBackend: ConversationBackend | null = null;
let defaultNodeBackend: ConversationBackend | null = null;

/** Inject a custom backend (e.g. Bun sqlite for the UI gateway). */
export function setConversationBackend(backend: ConversationBackend): void {
  injectedBackend = backend;
}

export function getConversationBackend(): ConversationBackend {
  if (injectedBackend) return injectedBackend;
  if (!defaultNodeBackend) {
    defaultNodeBackend = createNodeConversationBackend();
  }
  return defaultNodeBackend;
}
