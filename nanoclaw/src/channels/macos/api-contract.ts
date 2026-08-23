/**
 * Canonical HTTP contract for the macOS internal channel (motor ↔ UI Bun ↔ clients).
 * Keep response shapes aligned across internal-api, nanoclaw-motor-client, and Swift models.
 */

export type ConversationMode = 'new' | 'new-resume';

export interface MacPromptRequest {
  prompt: string;
  sessionId?: string;
  /** @deprecated Prefer conversationMode — kept for backward compatibility. */
  resetSession?: boolean;
  conversationMode?: ConversationMode;
}

export interface MacTurnResponse {
  success: true;
  reply: string;
  timestamp: string;
  toolsExecutedCount: number;
  sessionId: string;
}

export interface MacResetRequest {
  mode?: ConversationMode;
}

export interface MacResetResponse {
  success: true;
  message: string;
  sessionId: string;
}

export interface MacErrorResponse {
  success?: false;
  error: string;
}
