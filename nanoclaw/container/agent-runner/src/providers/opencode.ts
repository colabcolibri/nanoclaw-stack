import { registerProvider } from './provider-registry.js';
import type { AgentProvider, AgentQuery, ProviderEvent, ProviderOptions, QueryInput } from './types.js';
import { QUESTION_STEERING_TEXT, createCompactionReminder } from './opencode/compaction.js';
import { buildOpenCodeConfig } from './opencode/config.js';
import { SESSION_STATUS_RETRY_ERROR_AFTER, STALE_SESSION_RE, log, sessionErrorMessage } from './opencode/shared.js';
import { destroySharedRuntime, ensureSharedRuntime, type SharedRuntime } from './opencode/server.js';
import { buildAttachmentFileParts, buildPromptParts, wrapPromptWithContext } from './opencode/prompt-parts.js';
import type { OpenCodePromptAttachment } from './opencode/prompt-parts.js';
import { createMemoryLifecycle, runMemorySessionHook } from './opencode/memory-lifecycle.js';
import type { OpenCodeMemorySessionHook } from './opencode/memory-lifecycle.js';
import { handleQuestionAsked } from './opencode/questions.js';

// API pública preservada — implementações vivem em providers/opencode/*.
export { buildOpenCodeConfig } from './opencode/config.js';
export type { SharedRuntime } from './opencode/server.js';
export { destroySharedRuntime, ensureSharedRuntime } from './opencode/server.js';
export type { OpenCodePromptAttachment } from './opencode/prompt-parts.js';
export { buildAttachmentFileParts, buildPromptParts } from './opencode/prompt-parts.js';
export {
  QUESTION_STEERING_TEXT,
  buildPostCompactionReminder,
  createCompactionReminder,
} from './opencode/compaction.js';
export type { OpenCodeMemorySessionHook, OpenCodeMemorySource } from './opencode/memory-lifecycle.js';
export { createMemoryLifecycle, runMemorySessionHook } from './opencode/memory-lifecycle.js';
export type { QuestionClient } from './opencode/questions.js';
export { autoAnswerQuestion, drainPendingQuestions, handleQuestionAsked } from './opencode/questions.js';

export class OpenCodeProvider implements AgentProvider {
  readonly supportsNativeSlashCommands = false;

  private readonly options: ProviderOptions;
  private activeSessionId: string | undefined;
  private memorySessionHook?: OpenCodeMemorySessionHook;

  constructor(options: ProviderOptions = {}) {
    this.options = options;
  }

  // OpenCode has no native session-start hook mechanism to hand the command to
  // (as the Claude Agent SDK's settings.json and Codex's hooks.json have), so
  // the provider stores the registration and runs the command itself at the
  // lifecycle points OpenCode does expose — see createMemoryLifecycle.
  registerMemorySessionHook(hook: OpenCodeMemorySessionHook): void {
    this.memorySessionHook = hook;
  }

  isSessionInvalid(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return STALE_SESSION_RE.test(msg);
  }

  query(input: QueryInput): AgentQuery {
    // Same refusal as the Codex provider: the runner registers the shared hook
    // unconditionally before polling, so an unregistered provider means the
    // wiring broke — fail loudly rather than run a memoryless agent forever.
    if (!this.memorySessionHook) throw new Error('OpenCode memory session hook was not registered');

    if (input.continuation) {
      this.activeSessionId = input.continuation;
    } else {
      this.activeSessionId = undefined;
    }

    const pending: Array<{ text: string; attachments?: OpenCodePromptAttachment[] }> = [];
    let waiting: (() => void) | null = null;
    let ended = false;
    let aborted = false;
    // Latch that re-injects the routing reminder on the next prompt after the
    // active session auto-compacts (see createCompactionReminder). Per-query so
    // it never leaks a pending reminder across independent query() calls.
    const compaction = createCompactionReminder();
    // Memory rides the same two moments a context window is (re)built: this
    // opening prompt when it starts a new session, and the first prompt after
    // a compaction. Never on a resume, never on an ordinary push.
    const memory = createMemoryLifecycle(this.memorySessionHook, Boolean(input.continuation));

    const systemInstructions = input.systemContext?.instructions;
    // Read structurally rather than off `QueryInput` directly: an agent-runner
    // that does not carry the attachment field still type-checks here, and
    // yields `undefined` — the same no-op as a turn that arrived without media.
    const openingAttachments = (input as QueryInput & { attachments?: OpenCodePromptAttachment[] }).attachments;
    pending.push({
      text: wrapPromptWithContext(input.prompt, memory.openingInstructions(systemInstructions)),
      attachments: openingAttachments,
    });

    const kick = (): void => {
      waiting?.();
    };

    const self = this;
    const IDLE_TIMEOUT_MS = Number(process.env.OPENCODE_IDLE_TIMEOUT_MS) || 300_000;

    async function* gen(): AsyncGenerator<ProviderEvent> {
      let initYielded = false;
      const rt = await ensureSharedRuntime(self.options);
      const { client, stream, questionClient } = rt;

      while (!aborted) {
        while (pending.length === 0 && !ended && !aborted) {
          await new Promise<void>((resolve) => {
            waiting = resolve;
          });
          waiting = null;
        }

        if (aborted) return;
        if (pending.length === 0 && ended) return;

        const { text, attachments } = pending.shift()!;
        let sessionId = self.activeSessionId;

        if (!sessionId) {
          const created = await client.session.create();
          if (created.error) {
            throw new Error(`OpenCode: failed to create session: ${JSON.stringify(created.error)}`);
          }
          sessionId = created.data?.id;
          if (!sessionId) throw new Error('OpenCode: failed to create session (no id)');
          self.activeSessionId = sessionId;
        }

        if (!initYielded) {
          yield { type: 'init', continuation: sessionId };
          initYielded = true;
        }

        const promptRes = await client.session.promptAsync({
          path: { id: sessionId },
          body: { parts: buildPromptParts(text, attachments) },
        });
        if (promptRes.error) {
          self.activeSessionId = undefined;
          throw new Error(`OpenCode promptAsync: ${JSON.stringify(promptRes.error)}`);
        }

        const partTextByMessageId = new Map<string, string>();
        const roleByMessageId = new Map<string, string>();
        let lastEventAt = Date.now();
        let eventTimedOut = false;
        const timeoutCheck = setInterval(() => {
          if (Date.now() - lastEventAt > IDLE_TIMEOUT_MS) {
            log(`OpenCode event timeout (${IDLE_TIMEOUT_MS}ms) — clearing session ${sessionId}`);
            eventTimedOut = true;
            self.activeSessionId = undefined;
            destroySharedRuntime();
            kick();
          }
        }, 5000);

        try {
          turn: while (true) {
            if (aborted) return;
            if (eventTimedOut) {
              throw new Error(`OpenCode event timeout (${IDLE_TIMEOUT_MS}ms)`);
            }

            const { value: ev, done } = await stream.next();
            if (done) {
              throw new Error('OpenCode SSE stream ended unexpectedly');
            }

            if (!ev?.type || ev.type === 'server.connected' || ev.type === 'server.heartbeat') continue;

            lastEventAt = Date.now();
            yield { type: 'activity' };

            switch (ev.type) {
              case 'message.updated': {
                const info = ev.properties.info as { id?: string; role?: string } | undefined;
                if (info?.id && info?.role) {
                  roleByMessageId.set(info.id, info.role);
                }
                break;
              }
              case 'message.part.updated': {
                const part = ev.properties.part as { type?: string; messageID?: string; text?: string } | undefined;
                if (part?.type === 'text' && part.messageID && part.text) {
                  partTextByMessageId.set(part.messageID, part.text);
                }
                break;
              }
              case 'permission.updated': {
                const perm = ev.properties as { id?: string; sessionID?: string };
                if (perm.sessionID === sessionId && perm.id) {
                  try {
                    await client.postSessionIdPermissionsPermissionId({
                      path: { id: sessionId, permissionID: perm.id },
                      body: { response: 'always' },
                    });
                  } catch (err) {
                    log(`Failed to auto-reply permission: ${err instanceof Error ? err.message : String(err)}`);
                  }
                }
                break;
              }
              case 'question.asked': {
                const req = ev.properties as { id?: string; sessionID?: string; questions?: unknown[] };
                await handleQuestionAsked(questionClient, req);
                break;
              }
              case 'session.status': {
                const props = ev.properties as {
                  sessionID?: string;
                  status?: { type?: string; attempt?: number; message?: string };
                };
                if (props.sessionID !== sessionId) break;
                const st = props.status;
                if (
                  st?.type === 'retry' &&
                  typeof st.attempt === 'number' &&
                  st.attempt >= SESSION_STATUS_RETRY_ERROR_AFTER &&
                  st.message
                ) {
                  self.activeSessionId = undefined;
                  throw new Error(`OpenCode retry limit (${st.attempt}): ${st.message}`);
                }
                break;
              }
              case 'session.error': {
                const props = ev.properties as { sessionID?: string; error?: unknown };
                if (props.sessionID === sessionId || props.sessionID === undefined) {
                  self.activeSessionId = undefined;
                  throw new Error(sessionErrorMessage(props));
                }
                break;
              }
              case 'session.compacted': {
                // The active session was just auto-compacted; arm the routing
                // reminder for the next prompt. Filter by sessionID like the
                // other cases — the shared server emits this for every session.
                const sid = (ev.properties as { sessionID?: string }).sessionID;
                compaction.note(sid, sessionId);
                break;
              }
              case 'session.idle': {
                const sid = (ev.properties as { sessionID?: string }).sessionID;
                if (sid === sessionId) {
                  break turn;
                }
                break;
              }
              default:
                break;
            }
          }
        } finally {
          clearInterval(timeoutCheck);
        }

        let resultText = '';
        for (const [msgId, role] of roleByMessageId) {
          if (role === 'assistant') {
            resultText = partTextByMessageId.get(msgId) ?? resultText;
          }
        }
        yield { type: 'result', text: resultText || null };
      }
    }

    return {
      push: (message: string, attachments?: OpenCodePromptAttachment[]) => {
        // If the active session compacted mid-conversation, memory and the
        // routing reminder both ride this next prompt (once each), then the
        // latch disarms. Read the latch BEFORE apply() consumes it. Order is
        // memory, then reminder, then the user's text.
        const justCompacted = compaction.isArmed;
        pending.push({
          text: wrapPromptWithContext(memory.pushPrefix(justCompacted) + compaction.apply(message), systemInstructions),
          attachments,
        });
        kick();
      },
      end: () => {
        ended = true;
        kick();
      },
      events: gen(),
      abort: () => {
        aborted = true;
        this.activeSessionId = undefined;
        kick();
        destroySharedRuntime();
      },
    };
  }
}

registerProvider('opencode', (opts) => new OpenCodeProvider(opts));
