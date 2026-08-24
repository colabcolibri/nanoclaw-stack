/**
 * Telegram Bot API — slash-command menu registration.
 *
 * Reads command metadata from the host slash registry (single source of truth)
 * and publishes it via setMyCommands so the Telegram client shows autocomplete.
 */
import { getTelegramBotCommands } from '../../commands/index.js';
import { log } from '../../log.js';

export async function registerTelegramBotCommands(token: string, fetchFn: typeof fetch = fetch): Promise<boolean> {
  const commands = getTelegramBotCommands();
  if (commands.length === 0) return true;

  try {
    const res = await fetchFn(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ commands }),
    });
    const json = (await res.json()) as { ok?: boolean; description?: string };
    if (!json.ok) {
      log.warn('Telegram setMyCommands rejected', { description: json.description });
      return false;
    }
    log.info('Telegram bot commands registered', { count: commands.length });
    return true;
  } catch (err) {
    log.warn('Telegram setMyCommands failed', { err });
    return false;
  }
}
