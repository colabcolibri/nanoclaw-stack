/**
 * Suporte a Gateway adapters (ex.: Discord) — servidor HTTP local que recebe
 * eventos forwardados (incluindo interações de botão) e o decode do custom_id.
 */
import http from 'http';

import type { Adapter } from 'chat';
import { log } from '../log.js';
import { resolveQuestionRender } from './question-render-registry.js';
import type { NormalizedOption } from './ask-question.js';
import type { ChannelSetup } from './adapter.js';

/** Adapter with optional gateway support (e.g., Discord). */
export interface GatewayAdapter extends Adapter {
  startGatewayListener?(
    options: { waitUntil?: (task: Promise<unknown>) => void },
    durationMs?: number,
    abortSignal?: AbortSignal,
    webhookUrl?: string,
  ): Promise<Response>;
}

/**
 * Decode the actual option value from a button callback. Buttons are encoded
 * with an integer index (to keep under Telegram's 64-byte callback_data cap),
 * and the real value is looked up via `getAskQuestionRender(questionId)`.
 * Falls back to treating the tail as a literal value so old in-flight cards
 * (encoded before this shortening landed) still resolve.
 */
export function resolveSelectedOption(
  render: { options: NormalizedOption[] } | undefined,
  eventValue: string | undefined,
  tail: string | undefined,
): string {
  const candidate = eventValue ?? tail ?? '';
  if (render && /^\d+$/.test(candidate)) {
    const idx = Number(candidate);
    if (render.options[idx]) return render.options[idx].value;
  }
  return candidate;
}

/**
 * Start a local HTTP server to receive forwarded Gateway events.
 * This is needed because the Gateway listener in webhook-forwarding mode
 * sends ALL raw events (including INTERACTION_CREATE for button clicks)
 * to the webhookUrl, which we handle here.
 */
export function startLocalWebhookServer(
  adapter: GatewayAdapter,
  setupConfig: ChannelSetup,
  botToken?: string,
): Promise<string> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        handleForwardedEvent(body, adapter, setupConfig, botToken)
          .then(() => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('{"ok":true}');
          })
          .catch((err) => {
            log.error('Webhook server error', { err });
            res.writeHead(500);
            res.end('{"error":"internal"}');
          });
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      const url = `http://127.0.0.1:${addr.port}/webhook`;
      log.info('Local webhook server started', { port: addr.port });
      resolve(url);
    });
  });
}

async function handleForwardedEvent(
  body: string,
  adapter: GatewayAdapter,
  setupConfig: ChannelSetup,
  botToken?: string,
): Promise<void> {
  let event: { type: string; data: Record<string, unknown> };
  try {
    event = JSON.parse(body);
  } catch {
    return;
  }

  // Handle interaction events (button clicks) — not handled by adapter's handleForwardedGatewayEvent
  if (event.type === 'GATEWAY_INTERACTION_CREATE' && event.data) {
    const interaction = event.data;
    // type 3 = MessageComponent (button/select)
    if (interaction.type === 3) {
      const customId = (interaction.data as Record<string, unknown>)?.custom_id as string;
      // In guilds the clicker is at interaction.member.user; in DMs it's interaction.user directly.
      const user =
        ((interaction.member as Record<string, unknown>)?.user as Record<string, string> | undefined) ??
        (interaction.user as Record<string, string> | undefined);
      const interactionId = interaction.id as string;
      const interactionToken = interaction.token as string;

      // Parse the selected option from custom_id
      let questionId: string | undefined;
      let tail: string | undefined;
      if (customId?.startsWith('ncq:')) {
        const colonIdx = customId.indexOf(':', 4); // after "ncq:"
        if (colonIdx !== -1) {
          questionId = customId.slice(4, colonIdx);
          tail = customId.slice(colonIdx + 1);
        }
      }

      // Update the card to show the selected answer and remove buttons
      const originalEmbeds =
        ((interaction.message as Record<string, unknown>)?.embeds as Array<Record<string, unknown>>) || [];
      const originalDescription = (originalEmbeds[0]?.description as string) || '';
      const render = questionId ? resolveQuestionRender(questionId) : undefined;
      // Discord custom_id mirrors the new index-based encoding (see Button
      // construction). Decode back to the real option value for downstream.
      const selectedOption = resolveSelectedOption(render, tail, tail);
      const cardTitle = render?.title ?? ((originalEmbeds[0]?.title as string) || '❓ Question');
      const matchedOpt = render?.options.find((o) => o.value === selectedOption);
      const selectedLabel = matchedOpt?.selectedLabel ?? selectedOption ?? customId;
      try {
        await fetch(`https://discord.com/api/v10/interactions/${interactionId}/${interactionToken}/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 7, // UPDATE_MESSAGE — acknowledge + update in one call
            data: {
              embeds: [
                {
                  title: cardTitle,
                  description: `${originalDescription}\n\n${selectedLabel}`,
                },
              ],
              components: [], // remove buttons
            },
          }),
        });
      } catch (err) {
        log.error('Failed to update interaction', { err });
      }

      // Dispatch to host
      if (questionId && selectedOption) {
        setupConfig.onAction(questionId, selectedOption, user?.id || '');
      }
      return;
    }
  }

  // Forward other events to the adapter's webhook handler for normal processing
  const fakeRequest = new Request('http://localhost/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-discord-gateway-token': botToken || '',
    },
    body,
  });
  await adapter.handleWebhook(fakeRequest, {});
}
