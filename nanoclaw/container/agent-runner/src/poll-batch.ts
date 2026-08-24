import {
  getPendingMessages,
  markProcessing,
  markCompleted,
  markScriptSkipped,
  type MessageInRow,
} from './db/messages-in.js';
import { writeMessageOut } from './db/messages-out.js';
import {
  extractRouting,
  formatMessages,
  categorizeMessage,
  isClearCommand,
  type RoutingContext,
} from './formatter.js';
import { isUploadTraceCommand, uploadTrace } from './upload-trace.js';
import { generateId, log } from './poll-shared.js';

export type PollBatch =
  | { kind: 'wait' }
  | { kind: 'skip' }
  | {
      kind: 'ready';
      routing: RoutingContext;
      prompt: string;
      keptMessages: MessageInRow[];
      processingIds: string[];
      batchSize: number;
    };

/**
 * Read and prepare the next inbound batch: fetch pending rows, apply the
 * accumulate gate, handle direct commands, run pre-task scripts and format
 * the prompt. Side effects (claims, acks, command replies) happen here in the
 * same order the inline loop performed them; `onClearSession` keeps the /clear
 * continuation reset inline with the command's own reply write.
 */
export async function preparePollBatch(
  pollCount: number,
  isFirstPoll: boolean,
  nativeSlashCommands: boolean,
  onClearSession: () => void,
): Promise<PollBatch> {
  // Skip system messages — they're responses for MCP tools (e.g., ask_user_question)
  const messages = getPendingMessages(isFirstPoll).filter((m) => m.kind !== 'system');

  // Periodic heartbeat so we know the loop is alive
  if (pollCount % 30 === 0) {
    log(`Poll heartbeat (${pollCount} iterations, ${messages.length} pending)`);
  }

  if (messages.length === 0) return { kind: 'wait' };

  // Accumulate gate: if the batch contains only trigger=0 rows
  // (context-only, router-stored under ignored_message_policy='accumulate'),
  // don't wake the agent. Leave them `pending` — they'll ride along the
  // next time a real trigger=1 message lands via this same getPendingMessages
  // query. Without this gate, a warm container keeps processing
  // (and potentially responding to) every accumulate-only batch, defeating
  // the "store as context, don't engage" contract. Host-side countDueMessages
  // gates the same way for wake-from-cold (see src/db/session-db.ts).
  if (!messages.some((m) => m.trigger === 1)) return { kind: 'wait' };

  const ids = messages.map((m) => m.id);
  markProcessing(ids);

  const routing = extractRouting(messages);

  // Command handling: the host router gates filtered and unauthorized
  // admin commands before they reach the container. The only command
  // the runner handles directly is /clear (session reset).
  const normalMessages: MessageInRow[] = [];
  const commandIds: string[] = [];

  for (const msg of messages) {
    if ((msg.kind === 'chat' || msg.kind === 'chat-sdk') && isClearCommand(msg)) {
      log('Clearing session (resetting continuation)');
      onClearSession();
      writeMessageOut({
        id: generateId(),
        kind: 'chat',
        platform_id: routing.platformId,
        channel_type: routing.channelType,
        thread_id: routing.threadId,
        content: JSON.stringify({ text: 'Session cleared.' }),
      });
      commandIds.push(msg.id);
      continue;
    }
    if ((msg.kind === 'chat' || msg.kind === 'chat-sdk') && isUploadTraceCommand(msg)) {
      log('Uploading session trace to Hugging Face');
      writeMessageOut({
        id: generateId(),
        kind: 'chat',
        platform_id: routing.platformId,
        channel_type: routing.channelType,
        thread_id: routing.threadId,
        content: JSON.stringify({ text: uploadTrace() }),
      });
      commandIds.push(msg.id);
      continue;
    }
    normalMessages.push(msg);
  }

  if (commandIds.length > 0) {
    markCompleted(commandIds);
  }

  if (normalMessages.length === 0) {
    const remainingIds = ids.filter((id) => !commandIds.includes(id));
    if (remainingIds.length > 0) markCompleted(remainingIds);
    log(`All ${messages.length} message(s) were commands, skipping query`);
    return { kind: 'skip' };
  }

  // Pre-task scripts: for any task rows with a `script`, run it before the
  // provider call. Scripts returning wakeAgent=false (or erroring) gate
  // their own task row only — surviving messages still go to the agent.
  // Without the scheduling module, the marker block is empty, `keep`
  // falls back to `normalMessages`, and no gating happens.
  let keep: MessageInRow[] = normalMessages;
  let skipped: Array<{ id: string; reason: string }> = [];
  // MODULE-HOOK:scheduling-pre-task:start
  const { applyPreTaskScripts } = await import('./scheduling/task-script.js');
  const preTask = await applyPreTaskScripts(normalMessages);
  keep = preTask.keep;
  skipped = preTask.skipped;
  if (skipped.length > 0) {
    markScriptSkipped(skipped);
    log(`Pre-task script skipped ${skipped.length} task(s): ${skipped.map((s) => s.id).join(', ')}`);
  }
  // MODULE-HOOK:scheduling-pre-task:end

  if (keep.length === 0) {
    log(`All ${normalMessages.length} non-command message(s) gated by script, skipping query`);
    return { kind: 'skip' };
  }

  const prompt = formatMessagesWithCommands(keep, nativeSlashCommands);

  log(`Processing ${keep.length} message(s), kinds: ${[...new Set(keep.map((m) => m.kind))].join(',')}`);

  const skippedSet = new Set(skipped.map((s) => s.id));
  const processingIds = ids.filter((id) => !commandIds.includes(id) && !skippedSet.has(id));

  return { kind: 'ready', routing, prompt, keptMessages: keep, processingIds, batchSize: ids.length };
}

/**
 * Format messages, handling passthrough commands differently.
 * When the provider handles slash commands natively (Claude Code),
 * passthrough commands are sent raw (no XML wrapping) so the SDK can
 * dispatch them. Otherwise they fall through to standard XML formatting.
 */
function formatMessagesWithCommands(messages: MessageInRow[], nativeSlashCommands: boolean): string {
  const parts: string[] = [];
  const normalBatch: MessageInRow[] = [];

  for (const msg of messages) {
    if (nativeSlashCommands && (msg.kind === 'chat' || msg.kind === 'chat-sdk')) {
      const cmdInfo = categorizeMessage(msg);
      if (cmdInfo.category === 'passthrough' || cmdInfo.category === 'admin') {
        // Flush normal batch first
        if (normalBatch.length > 0) {
          parts.push(formatMessages(normalBatch));
          normalBatch.length = 0;
        }
        // Pass raw command text (no XML wrapping) — SDK handles it natively
        parts.push(cmdInfo.text);
        continue;
      }
    }
    normalBatch.push(msg);
  }

  if (normalBatch.length > 0) {
    parts.push(formatMessages(normalBatch));
  }

  return parts.join('\n\n');
}
