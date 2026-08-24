/**
 * Chat SDK bridge — wraps a Chat SDK adapter + Chat instance
 * to conform to the NanoClaw ChannelAdapter interface.
 *
 * Used by Discord, Slack, and other Chat SDK-supported platforms.
 */
import {
  Chat,
  Card,
  CardText,
  Actions,
  Button,
  type Adapter,
  type CardElement,
  type ConcurrencyStrategy,
  type Message as ChatMessage,
  type SlashCommandEvent,
} from 'chat';
import { log } from '../log.js';
import { SqliteStateAdapter } from '../state-sqlite.js';
import { registerWebhookAdapter } from '../webhook-server.js';
import { resolveQuestionRender } from './question-render-registry.js';
import { normalizeOptions, type NormalizedOption } from './ask-question.js';
import type { ChannelAdapter, ChannelDefaults, ChannelSetup, InboundMessage } from './adapter.js';
import {
  appContextEntities,
  attachAppContext,
  cacheAppContext,
  notifyAgentDmOpened,
  type AgentDmOpenedEvent,
  type AppContextEntity,
} from './chat-sdk-app-context.js';
import { buildDisplayCard, hasDisplayCardBody, type DisplayCardInput } from './chat-sdk-cards.js';
import { resolveSelectedOption, startLocalWebhookServer, type GatewayAdapter } from './chat-sdk-gateway.js';
import { messageToInbound } from './chat-sdk-inbound.js';

// API pública preservada — implementações vivem nos módulos irmãos.
export type { AgentDmOpenedEvent, AppContextEntity };
export {
  attachAppContext,
  appContextEntities,
  cacheAppContext,
  normalizeDmThreadId,
  setAgentDmOpenedHandler,
  takeAppContext,
} from './chat-sdk-app-context.js';

type TelegramSlashRaw = {
  message_id?: number;
  date?: number;
  chat?: { id: number | string; type?: string };
};

/**
 * Telegram (and other Chat SDK adapters) detect `bot_command` entities and
 * dispatch via `onSlashCommand`, skipping `onDirectMessage` / `onNewMessage`.
 * Forward slash commands into the host router so `/new`, `/clear`, etc. work.
 */
export function slashCommandToInbound(event: SlashCommandEvent): InboundMessage {
  const fullText = event.text.trim() ? `${event.command} ${event.text.trim()}` : event.command;
  const raw = event.raw as TelegramSlashRaw | undefined;
  const chatInfo = raw?.chat;
  const isGroup = chatInfo?.type !== undefined && chatInfo.type !== 'private';
  const msgId =
    raw?.message_id !== undefined && chatInfo?.id !== undefined
      ? `${chatInfo.id}:${raw.message_id}`
      : `slash-${Date.now()}`;
  const timestamp = raw?.date !== undefined ? new Date(raw.date * 1000).toISOString() : new Date().toISOString();
  const author = event.user;
  const name = author.fullName ?? author.userName;
  return {
    id: msgId,
    kind: 'chat-sdk',
    content: {
      text: fullText,
      author,
      senderId: author.userId,
      sender: name,
      senderName: name,
    },
    timestamp,
    isMention: true,
    isGroup,
  };
}

/** Reply context extracted from a platform's raw message. */
export interface ReplyContext {
  text: string;
  sender: string;
}

/** Extract reply context from a platform-specific raw message. Return null if no reply. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReplyContextExtractor = (raw: Record<string, any>) => ReplyContext | null;

export interface ChatSdkBridgeConfig {
  adapter: Adapter;
  /**
   * Adapter-instance name for running multiple bridges of one platform
   * whose underlying Chat SDK adapters share a hardcoded `name` (e.g. the
   * WhatsApp Cloud bridge, whose `@chat-adapter/whatsapp` reports
   * `name = "whatsapp"`, running next to the native Baileys `whatsapp`
   * adapter). Sets the returned adapter's registry key — `activeAdapters`
   * is keyed by `instance ?? channelType`, so a named instance no longer
   * collides with a sibling adapter of the same platform. Defaults to the
   * platform name. channelType is NOT affected — user identity, formatting,
   * and container config stay keyed on the platform.
   * Must be URL-safe: non-empty, only letters, digits, '.', '_' or '-'.
   */
  instance?: string;
  concurrency?: ConcurrencyStrategy;
  /** Bot token for authenticating forwarded Gateway events (required for interaction handling). */
  botToken?: string;
  /** Platform-specific reply context extraction. */
  extractReplyContext?: ReplyContextExtractor;
  /**
   * Whether this platform uses threads as the primary conversation unit.
   * See `ChannelAdapter.supportsThreads`. Declared by the calling channel
   * skill, not inferred, because some platforms (Discord) can be used either
   * way and the default depends on installation style.
   */
  supportsThreads: boolean;
  /**
   * Declared wiring-time defaults for this channel. Copied verbatim onto the
   * returned ChannelAdapter, exactly like supportsThreads. See
   * `ChannelAdapter.defaults`.
   */
  defaults?: ChannelDefaults;
  /**
   * Optional transform applied to outbound text/markdown before it reaches the
   * adapter. Used by channels that need to sanitize for a platform-specific
   * quirk (e.g. Telegram's legacy Markdown parse mode).
   */
  transformOutboundText?: (text: string) => string;
  /**
   * Maximum text length the underlying adapter accepts in a single message.
   * When set, the bridge splits outbound text longer than this on paragraph
   * → line → hard-char boundaries and posts multiple messages. Without this,
   * adapters like Discord (2000) and Telegram (4096) silently truncate
   * mid-response. The returned id is the first chunk's id so subsequent edits
   * and reactions still target the head of the reply.
   */
  maxTextLength?: number;
}

/**
 * Split `text` into chunks no larger than `limit`, preferring paragraph
 * breaks, then line breaks, then a hard character cut as a last resort.
 * Preserves code fences only structurally — a fenced block that straddles a
 * chunk boundary will render as two independent blocks on the receiving
 * platform, which is the same behavior as manually re-opening a fence.
 */
export function splitForLimit(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf('\n\n', limit);
    if (cut <= 0) cut = remaining.lastIndexOf('\n', limit);
    if (cut <= 0) cut = remaining.lastIndexOf(' ', limit);
    if (cut <= 0) cut = limit;
    chunks.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

export function createChatSdkBridge(config: ChatSdkBridgeConfig): ChannelAdapter {
  const { adapter } = config;
  // The instance name becomes the registry key (and, once the core
  // instance-routing infra lands, a webhook route segment and the
  // state-namespace delimiter). Reject anything non-URL-safe at construction
  // time rather than at first webhook. Positive allow-list (not a deny-list):
  // also rejects '' and whitespace-only names, which are config bugs that
  // would silently collapse back onto the default instance's keyspace.
  if (config.instance !== undefined && !/^[A-Za-z0-9._-]+$/.test(config.instance)) {
    throw new Error(
      `chat-sdk bridge instance ${JSON.stringify(config.instance)} must be URL-safe: ` +
        `non-empty, only letters, digits, '.', '_' or '-'`,
    );
  }
  const transformText = (t: string): string => (config.transformOutboundText ? config.transformOutboundText(t) : t);
  const instanceKey = () => config.instance ?? adapter.name;
  const stateNamespace = config.instance && config.instance !== adapter.name ? config.instance : undefined;
  let chat: Chat;
  let state: SqliteStateAdapter;
  let setupConfig: ChannelSetup;
  let gatewayAbort: AbortController | null = null;

  const inboundFromMessage = (message: ChatMessage, isMention: boolean, isGroup?: boolean): Promise<InboundMessage> =>
    messageToInbound(message, isMention, isGroup, config.extractReplyContext);

  const bridge: ChannelAdapter & { _chat?: Chat } = {
    name: config.instance ?? adapter.name,
    channelType: adapter.name, // unchanged — semantic platform key
    instance: config.instance, // undefined ⇒ default instance (keyed by channelType)
    supportsThreads: config.supportsThreads,
    defaults: config.defaults,

    async setup(hostConfig: ChannelSetup) {
      setupConfig = hostConfig;

      state = new SqliteStateAdapter(stateNamespace);

      chat = new Chat({
        adapters: { [adapter.name]: adapter },
        userName: adapter.userName || 'NanoClaw',
        concurrency: config.concurrency ?? 'concurrent',
        state,
        logger: 'silent',
      });

      // Four SDK dispatch paths — bridge just forwards. All per-wiring
      // engage / accumulate / drop / subscribe decisions live in the host
      // router (src/router.ts routeInbound / evaluateEngage). The bridge
      // only resolves channel ids and sets the platform-confirmed isMention
      // flag that routeInbound evaluates; the router calls back into
      // bridge.subscribe(...) when a mention-sticky wiring engages.

      // Telegram bot commands (`bot_command` entity) never reach onDirectMessage —
      // the adapter calls Chat.processSlashCommand instead. Catch-all here so
      // host slash commands (/new, /clear, …) reach routeInbound.
      chat.onSlashCommand(async (event) => {
        const threadId = event.channel.id;
        const channelId = adapter.channelIdFromThreadId(threadId);
        log.info('Inbound slash command received', {
          adapter: adapter.name,
          channelId,
          command: event.command,
          threadId,
        });
        await setupConfig.onInbound(channelId, threadId, slashCommandToInbound(event));
      });

      chat.onAssistantContextChanged(async (event) => {
        const entities = appContextEntities(event);
        if (entities.length) cacheAppContext(instanceKey(), event.channelId, event.userId, entities);
      });

      chat.onAssistantThreadStarted(async (event) => {
        const entities = appContextEntities(event);
        if (entities.length) cacheAppContext(instanceKey(), event.channelId, event.userId, entities);
        try {
          notifyAgentDmOpened({ instance: instanceKey(), channelId: event.channelId });
        } catch (err) {
          log.error('Agent-DM opened handler failed', { err });
        }
      });

      // Subscribed threads — every message in a thread we've previously
      // engaged. Carry the SDK's `message.isMention` through so mention-mode
      // wirings still fire on in-thread mentions.
      chat.onSubscribedMessage(async (thread, message) => {
        const channelId = adapter.channelIdFromThreadId(thread.id);
        await setupConfig.onInbound(
          channelId,
          thread.id,
          await inboundFromMessage(message, message.isMention === true, true),
        );
      });

      // @mention in an unsubscribed thread — SDK-confirmed bot mention.
      chat.onNewMention(async (thread, message) => {
        const channelId = adapter.channelIdFromThreadId(thread.id);
        await setupConfig.onInbound(channelId, thread.id, await inboundFromMessage(message, true, true));
      });

      // DMs — by definition addressed to the bot. Thread id flows through
      // unmodified (Slack users can open sub-threads inside a DM); whether it
      // is honored is policy, not transport: the channel's declared
      // dm.threads default (ChannelDefaults) or a per-wiring threads override
      // decides at router fanout whether replies land in-thread or all DM
      // sub-threads collapse into the one DM session.
      chat.onDirectMessage(async (thread, message) => {
        const channelId = adapter.channelIdFromThreadId(thread.id);
        log.info('Inbound DM received', {
          adapter: adapter.name,
          channelId,
          sender: (message.author as any)?.fullName ?? (message.author as any)?.userId ?? 'unknown',
          threadId: thread.id,
        });
        const inbound = await inboundFromMessage(message, true, false);
        const userId = (message.author as { userId?: string })?.userId;
        attachAppContext(inbound.content as Record<string, unknown>, instanceKey(), thread.id, userId);
        await setupConfig.onInbound(channelId, thread.id, inbound);
      });

      // Plain messages in unsubscribed threads.
      //
      // Chat SDK dispatch (handling-events.mdx §"Handler dispatch order") is
      // exclusive: subscribed → onSubscribedMessage; unsubscribed+mention →
      // onNewMention; unsubscribed+pattern-match → onNewMessage. Registering
      // with `/./` lets the router see every plain message on every
      // unsubscribed thread the bot can see. The router short-circuits via
      // getMessagingGroupWithAgentCount (~1 DB read) for unwired channels,
      // so forwarding every one is cheap enough to not need a bridge-side
      // flood gate.
      chat.onNewMessage(/./, async (thread, message) => {
        const channelId = adapter.channelIdFromThreadId(thread.id);
        await setupConfig.onInbound(channelId, thread.id, await inboundFromMessage(message, false, true));
      });

      // Handle button clicks (ask_user_question)
      chat.onAction(async (event) => {
        if (!event.actionId.startsWith('ncq:')) return;
        const parts = event.actionId.split(':');
        if (parts.length < 3) return;
        const questionId = parts[1];
        const tail = parts.slice(2).join(':');
        const userId = event.user?.userId || '';

        // Resolve render metadata BEFORE dispatching onAction (which deletes the row).
        const render = resolveQuestionRender(questionId);
        // New format: button id/value is an integer index into options (kept
        // short to fit Telegram's 64-byte callback_data cap). Old format:
        // the full value is embedded in actionId/value directly.
        const selectedOption = resolveSelectedOption(render, event.value, tail);
        const title = render?.title ?? '❓ Question';
        const matched = render?.options.find((o) => o.value === selectedOption);
        const selectedLabel = matched?.selectedLabel ?? selectedOption ?? '(clicked)';

        const actor = event.user?.userName ?? event.user?.fullName;
        const resolution = actor ? `${selectedLabel} by ${actor}` : selectedLabel;

        // Update the card to show the selected answer and remove buttons
        try {
          const tid = event.threadId;
          if (render?.question) {
            await adapter.editMessage(tid, event.messageId, {
              card: Card({
                title: render.title ?? title,
                children: [CardText(render.question), CardText(resolution, { style: 'muted' })],
              }),
            });
          } else {
            await adapter.editMessage(tid, event.messageId, {
              markdown: `${title}\n\n${resolution}`,
            });
          }
        } catch (err) {
          log.warn('Failed to update card after action', { err });
        }

        setupConfig.onAction(questionId, selectedOption, userId);
      });

      await chat.initialize();

      // Start Gateway listener for adapters that support it (e.g., Discord)
      const gatewayAdapter = adapter as GatewayAdapter;
      if (gatewayAdapter.startGatewayListener) {
        gatewayAbort = new AbortController();

        // Start local HTTP server to receive forwarded Gateway events (including interactions)
        const webhookUrl = await startLocalWebhookServer(gatewayAdapter, setupConfig, config.botToken);

        const startGateway = () => {
          if (gatewayAbort?.signal.aborted) return;
          // Capture the long-running listener promise via waitUntil
          let listenerPromise: Promise<unknown> | undefined;
          gatewayAdapter.startGatewayListener!(
            {
              waitUntil: (p: Promise<unknown>) => {
                listenerPromise = p;
              },
            },
            24 * 60 * 60 * 1000,
            gatewayAbort!.signal,
            webhookUrl,
          ).then(() => {
            // startGatewayListener resolves immediately with a Response;
            // the actual work is in the listenerPromise passed to waitUntil
            if (listenerPromise) {
              listenerPromise
                .then(() => {
                  if (!gatewayAbort?.signal.aborted) {
                    log.info('Gateway listener expired, restarting', { adapter: adapter.name });
                    startGateway();
                  }
                })
                .catch((err) => {
                  if (!gatewayAbort?.signal.aborted) {
                    log.error('Gateway listener error, restarting in 5s', { adapter: adapter.name, err });
                    setTimeout(startGateway, 5000);
                  }
                });
            }
          });
        };
        startGateway();
        log.info('Gateway listener started', { adapter: adapter.name });
      } else {
        // Non-gateway adapters (Slack, Teams, GitHub, etc.) — register on the shared webhook server
        registerWebhookAdapter(chat, adapter.name, config.instance ?? adapter.name);
      }

      bridge._chat = chat;
      log.info('Chat SDK bridge initialized', { adapter: adapter.name });
    },

    async deliver(platformId: string, threadId: string | null, message): Promise<string | undefined> {
      // platformId is already in the adapter's encoded format (e.g. "telegram:6037840640",
      // "discord:guildId:channelId") — use it directly as the thread ID
      const tid = threadId ?? platformId;
      const content = message.content as Record<string, unknown>;

      if (content.operation === 'edit' && content.messageId) {
        const terminalCard = content.terminalCard as
          | { title?: string; question?: string; resolution?: string }
          | undefined;
        if (terminalCard?.title) {
          await adapter.editMessage(tid, content.messageId as string, {
            card: Card({
              title: terminalCard.title,
              children: [
                CardText(terminalCard.question ?? ''),
                CardText(terminalCard.resolution ?? '', { style: 'muted' }),
              ],
            }),
          });
          return;
        }
        await adapter.editMessage(tid, content.messageId as string, {
          markdown: transformText((content.text as string) || (content.markdown as string) || ''),
        });
        return;
      }

      if (content.operation === 'reaction' && content.messageId && content.emoji) {
        await adapter.addReaction(tid, content.messageId as string, content.emoji as string);
        return;
      }

      // Ask question card — render as Card with buttons
      if (content.type === 'ask_question' && content.questionId && content.options) {
        const questionId = content.questionId as string;
        const title = content.title as string;
        const question = content.question as string;
        if (!title) {
          log.error('ask_question missing required title — skipping delivery', { questionId });
          return;
        }
        const options: NormalizedOption[] = normalizeOptions(content.options as never);
        const card = Card({
          title,
          children: [
            CardText(question),
            Actions(
              // Encode button id/value with the option index rather than the
              // full value. Telegram caps callback_data at 64 bytes, and
              // long values (e.g. ISO datetimes, URLs) push the JSON payload
              // well past that. The onAction handlers resolve the index back
              // to the real value via getAskQuestionRender(questionId).
              options.map((opt, idx) =>
                Button({
                  id: `ncq:${questionId}:${idx}`,
                  label: opt.label,
                  value: String(idx),
                  ...(opt.style ? { style: opt.style } : {}),
                }),
              ),
            ),
          ],
        });
        const result = await adapter.postMessage(tid, {
          card,
          fallbackText: `${title}\n\n${question}\nOptions: ${options.map((o) => o.label).join(', ')}`,
        });
        return result?.id;
      }

      if (content.type === 'card' && content.card) {
        const cardInput = content.card as DisplayCardInput;
        if (!hasDisplayCardBody(cardInput)) return;
        const card = buildDisplayCard(cardInput);
        const result = await adapter.postMessage(tid, {
          // buildDisplayCard produz um ChatElement; o SDK tipa postMessage com CardElement.
          card: card as unknown as CardElement,
          fallbackText: (content.fallbackText as string) || cardInput.title || '',
        });
        return result?.id;
      }

      // Normal message
      const rawText = (content.markdown as string) || (content.text as string);
      const text = rawText ? transformText(rawText) : rawText;
      if (text) {
        // Attach files if present (FileUpload format: { data, filename })
        const fileUploads = message.files?.map((f: { data: Buffer; filename: string }) => ({
          data: f.data,
          filename: f.filename,
        }));
        // Split if over the adapter's max length. Files ride on the first
        // chunk so the head of the reply still carries them.
        const chunks =
          config.maxTextLength && text.length > config.maxTextLength
            ? splitForLimit(text, config.maxTextLength)
            : [text];
        let firstId: string | undefined;
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const attachFiles = i === 0 && fileUploads && fileUploads.length > 0;
          const result = await adapter.postMessage(
            tid,
            attachFiles ? { markdown: chunk, files: fileUploads } : { markdown: chunk },
          );
          if (i === 0) firstId = result?.id;
        }
        return firstId;
      } else if (message.files && message.files.length > 0) {
        // Files only, no text
        const fileUploads = message.files.map((f: { data: Buffer; filename: string }) => ({
          data: f.data,
          filename: f.filename,
        }));
        const result = await adapter.postMessage(tid, { markdown: '', files: fileUploads });
        return result?.id;
      }
    },

    async setTyping(platformId: string, threadId: string | null) {
      const tid = threadId ?? platformId;
      await adapter.startTyping(tid);
    },

    async teardown() {
      gatewayAbort?.abort();
      await chat.shutdown();
      log.info('Chat SDK bridge shut down', { adapter: adapter.name });
    },

    isConnected() {
      return true;
    },

    async subscribe(_platformId: string, threadId: string) {
      // Chat SDK's subscription state lives on the StateAdapter (not on the
      // Chat instance itself). SqliteStateAdapter.subscribe is idempotent —
      // a second call on an already-subscribed thread is a no-op. threadId
      // is the SDK's thread id, which is what the router already has from
      // the original inbound event.
      await state.subscribe(threadId);
    },
  };

  // Only expose openDM when the underlying Chat SDK adapter implements it.
  // Delegate straight to adapter.openDM rather than going through chat.openDM:
  // the latter dispatches via inferAdapterFromUserId, which only recognizes
  // Discord snowflakes, Slack U-ids, Teams 29:-ids, and gChat users/-ids, and
  // throws for everything else (Telegram numeric ids, iMessage, Matrix, …).
  // Calling adapter.openDM directly also preserves the adapter's native
  // platform_id encoding via channelIdFromThreadId (e.g. "telegram:<chatId>"),
  // which matches what onInbound stores in messaging_groups — avoiding a
  // duplicate-row / decode-error cascade at delivery time. See user-dm.ts for
  // the direct-addressable fallback when the adapter has no openDM at all.
  if (adapter.openDM) {
    bridge.openDM = async (userHandle: string): Promise<string> => {
      const threadId = await adapter.openDM!(userHandle);
      return adapter.channelIdFromThreadId(threadId);
    };
  }

  return bridge;
}
