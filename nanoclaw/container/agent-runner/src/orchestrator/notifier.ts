import { writeMessageOut } from '../db/messages-out.js';
import { getSessionRouting } from '../db/session-routing.js';

export class IntermediateNotifier {
  /**
   * Sends an immediate conversational message to the user while background tools execute.
   */
  static notify(targetJid: string | null | undefined, text: string): void {
    if (!text || text.trim().length < 2) return;

    try {
      const routing = getSessionRouting();
      let platformId = routing.platform_id;
      let channelType = routing.channel_type || 'telegram';
      let threadId = routing.thread_id;

      if (targetJid && targetJid.includes(':')) {
        platformId = targetJid;
        channelType = targetJid.split(':')[0];
      }

      if (!platformId) return;

      writeMessageOut({
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: 'chat',
        platform_id: platformId,
        channel_type: channelType,
        thread_id: threadId,
        content: JSON.stringify({ text: text.trim() }),
      });
    } catch (err) {
      console.error('[IntermediateNotifier] Failed to write intermediate message:', err);
    }
  }

  /**
   * Resolves target destination JID from prompt metadata.
   */
  static resolveDestination(prompt: string, fallbackJid?: string): string {
    const fromMatch = prompt.match(/from="([^"]+)"/);
    if (fromMatch && fromMatch[1]) return fromMatch[1];

    const chatJidMatch = prompt.match(/chatJid="([^"]+)"/);
    if (chatJidMatch && chatJidMatch[1]) return chatJidMatch[1];

    return fallbackJid || 'telegram';
  }
}
