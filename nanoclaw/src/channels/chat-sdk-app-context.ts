/**
 * App-context cache — entidades do assistente (canal/thread) capturadas dos
 * eventos do Chat SDK e anexadas ao próximo DM do usuário. TTL curto: o valor
 * é consumido uma única vez.
 */

const SLACK_TS_RE = /^\d+\.\d+$/;
const APP_CONTEXT_TTL_MS = 5 * 60 * 1000;

export interface AppContextEntity {
  type: string;
  id: string;
}

export interface AgentDmOpenedEvent {
  instance: string;
  channelId: string;
}

interface CachedAppContext {
  entities: AppContextEntity[];
  expiresAt: number;
}

const appContextCache = new Map<string, CachedAppContext>();
let agentDmOpenedHandler: (event: AgentDmOpenedEvent) => void = () => {};

function normalizeChannelKey(channelId: string): string {
  const colon = channelId.indexOf(':');
  return colon >= 0 ? channelId.slice(colon + 1) : channelId;
}

function appContextKey(instance: string, channelId: string, userId: string): string {
  return `${instance}:${normalizeChannelKey(channelId)}:${userId}`;
}

export function cacheAppContext(
  instance: string,
  channelId: string,
  userId: string,
  entities: AppContextEntity[],
  now = Date.now(),
): void {
  appContextCache.set(appContextKey(instance, channelId, userId), {
    entities,
    expiresAt: now + APP_CONTEXT_TTL_MS,
  });
}

export function takeAppContext(
  instance: string,
  channelId: string,
  userId: string,
  now = Date.now(),
): AppContextEntity[] | undefined {
  const entry = appContextCache.get(appContextKey(instance, channelId, userId));
  if (!entry) return undefined;
  appContextCache.delete(appContextKey(instance, channelId, userId));
  if (now > entry.expiresAt) return undefined;
  return entry.entities;
}

export function attachAppContext(
  content: Record<string, unknown>,
  instance: string,
  channelId: string,
  userId: string | undefined,
): void {
  if (content.app_context !== undefined || !userId) return;
  const entities = takeAppContext(instance, channelId, userId);
  if (entities) content.app_context = { entities };
}

export function appContextEntities(event: {
  context?: {
    channelId?: string;
    entities?: Array<{ type?: string; id?: string }>;
  };
}): AppContextEntity[] {
  const ctx = event.context;
  if (!ctx) return [];
  if (Array.isArray(ctx.entities)) {
    return ctx.entities
      .filter(
        (entity): entity is { type: string; id: string } =>
          typeof entity.type === 'string' && typeof entity.id === 'string',
      )
      .map((entity) => ({ type: entity.type, id: entity.id }));
  }
  if (ctx.channelId) return [{ type: 'channel', id: ctx.channelId }];
  return [];
}

export function setAgentDmOpenedHandler(handler: (event: AgentDmOpenedEvent) => void): void {
  agentDmOpenedHandler = handler;
}

/** Dispara o handler registrado por setAgentDmOpenedHandler (uso interno da ponte). */
export function notifyAgentDmOpened(event: AgentDmOpenedEvent): void {
  agentDmOpenedHandler(event);
}

/** Roots agent-view DM threads on the message ts when the SDK leaves threadTs empty. */
export function normalizeDmThreadId(threadId: string, messageId: string): string {
  if (!messageId || !SLACK_TS_RE.test(messageId)) return threadId;
  if (threadId.endsWith(':')) return `${threadId}${messageId}`;
  return threadId;
}
