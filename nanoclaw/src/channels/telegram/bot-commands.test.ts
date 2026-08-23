import { afterEach, describe, expect, it, vi } from 'vitest';

import { getTelegramBotCommands } from '../../commands/index.js';
import { registerTelegramBotCommands } from './bot-commands.js';

describe('registerTelegramBotCommands', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the slash registry to setMyCommands', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await registerTelegramBotCommands('test-token', fetchMock as typeof fetch);

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/bottest-token/setMyCommands');
    expect(JSON.parse(init.body as string)).toEqual({ commands: getTelegramBotCommands() });
  });

  it('returns false when Telegram rejects the payload without throwing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ ok: false, description: 'BOT_COMMAND_INVALID' }),
    });

    const ok = await registerTelegramBotCommands('test-token', fetchMock as typeof fetch);

    expect(ok).toBe(false);
  });

  it('returns false on network failure without throwing', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));

    const ok = await registerTelegramBotCommands('test-token', fetchMock as typeof fetch);

    expect(ok).toBe(false);
  });
});
