/**
 * UI gateway bridge: injects Bun sqlite backend then reuses NanoClaw command registry + execute.
 */
import path from "node:path";
import { CONFIG } from "../config.js";
import { createBunConversationBackend } from "./bun-conversation-backend.js";

export type BridgeSession = import("../../../nanoclaw/src/types.ts").Session;

export interface CallerContext {
  agentGroupId: string;
  messagingGroupId: string | null;
  threadId: string;
  sessionMode: "per-thread" | "shared" | "agent-shared";
  channelType: string;
  platformId: string;
  userId: string;
}

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: string;
}

export interface DeliveryAddress {
  channelType: string;
  platformId: string;
  threadId: string;
}

export interface ParsedSlashCommand {
  id: string;
  token: string;
}

export interface ExecuteSlashCommandOptions {
  summarizeWithLlm?: (messages: ConversationMessage[]) => Promise<string>;
}

export interface SlashCommandResult {
  handled: boolean;
  reply: string;
  session: BridgeSession;
  commandId: string;
}

let backendReady = false;

interface LoadedConversationModule {
  parseSlashCommand: (content: string) => ParsedSlashCommand | null;
  isRegisteredSlashCommand: (content: string) => boolean;
  executeSlashCommand: (
    commandId: string,
    ctx: CallerContext,
    delivery: DeliveryAddress,
    options?: ExecuteSlashCommandOptions,
  ) => Promise<SlashCommandResult>;
  createLlmSummarizeFn: (
    completeFn: (messages: ConversationMessage[]) => Promise<string>,
  ) => (messages: ConversationMessage[]) => Promise<string>;
  resolveActiveSession: (ctx: CallerContext) => { session: BridgeSession; created: boolean };
  readConversationHistory: (
    agentGroupId: string,
    sessionId: string,
    limit?: number,
  ) => ConversationMessage[];
}

let loadedModule: LoadedConversationModule | null = null;

function nanoclawSrc(rel: string): string {
  return path.join(CONFIG.NANOCLAW_PATH, "src", rel);
}

/** Initialize Bun backend and inject into NanoClaw conversation layer. */
export async function ensureConversationDb(): Promise<void> {
  if (backendReady) return;

  const { setConversationBackend } = await import(nanoclawSrc("conversations/backend.js"));
  const backend = await createBunConversationBackend({
    dbPath: CONFIG.DB_PATH,
    dataPath: CONFIG.DATA_PATH,
    nanoclawPath: CONFIG.NANOCLAW_PATH,
  });
  setConversationBackend(backend);
  backendReady = true;
}

async function loadNanoclawConversationModule(): Promise<LoadedConversationModule> {
  if (loadedModule) return loadedModule;
  await ensureConversationDb();

  const { parseSlashCommand, isRegisteredSlashCommand } = await import(nanoclawSrc("commands/parse.js"));
  const { executeSlashCommand } = await import(nanoclawSrc("commands/execute.js"));
  const { createLlmSummarizeFn } = await import(nanoclawSrc("conversations/summarizer.js"));
  const { resolveActiveSession, readConversationHistory } = await import(nanoclawSrc("conversations/lifecycle.js"));

  loadedModule = {
    parseSlashCommand,
    isRegisteredSlashCommand,
    executeSlashCommand: async (commandId, ctx, delivery, options = {}) => {
      const result = await executeSlashCommand(
        commandId,
        ctx as import("../../../nanoclaw/src/conversations/types.ts").CallerContext,
        delivery,
        options,
      );
      return {
        handled: result.handled,
        reply: result.reply,
        session: result.session,
        commandId: result.commandId,
      };
    },
    createLlmSummarizeFn,
    resolveActiveSession,
    readConversationHistory,
  };
  return loadedModule;
}

export async function parseSlashCommand(content: string): Promise<ParsedSlashCommand | null> {
  const mod = await loadNanoclawConversationModule();
  return mod.parseSlashCommand(content);
}

export async function isRegisteredSlashCommand(content: string): Promise<boolean> {
  const mod = await loadNanoclawConversationModule();
  return mod.isRegisteredSlashCommand(content);
}

export async function executeSlashCommand(
  commandId: string,
  ctx: CallerContext,
  delivery: DeliveryAddress,
  options: ExecuteSlashCommandOptions = {},
): Promise<SlashCommandResult> {
  const mod = await loadNanoclawConversationModule();
  return mod.executeSlashCommand(commandId, ctx, delivery, options);
}

/** Load conversation helpers (registry-driven, Bun-safe backend). */
export async function loadConversationModule(): Promise<LoadedConversationModule> {
  return loadNanoclawConversationModule();
}

/** Path helpers for session DB files (via injected backend). */
export async function loadSessionManager() {
  await ensureConversationDb();
  const { getConversationBackend } = await import(nanoclawSrc("conversations/backend.js"));
  const backend = getConversationBackend();
  return {
    initSessionFolder: backend.initSessionFolder.bind(backend),
    inboundDbPath: backend.inboundDbPath.bind(backend),
    outboundDbPath: backend.outboundDbPath.bind(backend),
  };
}
