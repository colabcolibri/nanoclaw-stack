import { clearStaleProcessingAcks } from './db/connection.js';
import { markCompleted } from './db/messages-in.js';
import { writeMessageOut } from './db/messages-out.js';
import {
  clearContinuation,
  clearCurrentInReplyTo,
  migrateLegacyContinuation,
  setContinuation,
  setCurrentInReplyTo,
} from './db/session-state.js';
import type { AgentProvider } from './providers/types.js';
import { preparePollBatch } from './poll-batch.js';
import { processQuery } from './poll-query.js';
import { generateId, log } from './poll-shared.js';

const POLL_INTERVAL_MS = 1000;

export interface PollLoopConfig {
  provider: AgentProvider;
  /**
   * Name of the provider (e.g. "claude", "codex", "opencode"). Used to key
   * the stored continuation per-provider so flipping providers doesn't
   * resurrect a stale id from a different backend.
   */
  providerName: string;
  cwd: string;
  systemContext?: {
    instructions?: string;
  };
  /**
   * Optional stop signal. In production the loop runs until the container
   * dies; tests pass a signal so an abandoned loop actually exits instead of
   * polling forever and stealing messages from the next test's DB.
   */
  signal?: AbortSignal;
}

/**
 * Main poll loop. Runs indefinitely until the process is killed.
 *
 * 1. Poll messages_in for pending rows
 * 2. Format into prompt, call provider.query()
 * 3. While query active: continue polling, push new messages via provider.push()
 * 4. On result: write messages_out
 * 5. Mark messages completed
 * 6. Loop
 */
export async function runPollLoop(config: PollLoopConfig): Promise<void> {
  // Resume the agent's prior session from a previous container run if one
  // was persisted. The continuation is opaque to the poll-loop — the
  // provider decides how to use it (Claude resumes a .jsonl transcript,
  // other providers may reload a thread ID, etc.). Keyed per-provider so
  // a Codex thread id never gets handed to Claude or vice versa.
  let continuation: string | undefined = migrateLegacyContinuation(config.providerName);

  // Before resuming, drop a session whose on-disk transcript has grown too
  // large/old to cold-resume within the host's idle ceiling. Without this a
  // long-lived hub keeps trying to reload an ever-growing .jsonl, hangs the
  // first turn, and gets killed before it can reply (then repeats forever).
  if (continuation) {
    const rotateReason = config.provider.maybeRotateContinuation?.(continuation, config.cwd);
    if (rotateReason) {
      log(`Rotating session — ${rotateReason}; starting fresh`);
      clearContinuation(config.providerName);
      continuation = undefined;
    }
  }

  if (continuation) {
    log(`Resuming agent session ${continuation}`);
  }

  // Clear leftover 'processing' acks from a previous crashed container.
  // This lets the new container re-process those messages.
  clearStaleProcessingAcks();

  let pollCount = 0;
  let isFirstPoll = true;
  while (true) {
    if (config.signal?.aborted) return;

    pollCount++;
    const batch = await preparePollBatch(
      pollCount,
      isFirstPoll,
      config.provider.supportsNativeSlashCommands,
      () => {
        continuation = undefined;
        clearContinuation(config.providerName);
      },
    );
    isFirstPoll = false;

    if (batch.kind === 'wait') {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    if (batch.kind !== 'ready') continue;

    const { routing, prompt, keptMessages, processingIds, batchSize } = batch;
    const triggerMessageId = routing.inReplyTo || (keptMessages[0] ? keptMessages[0].id : undefined);

    const query = config.provider.query({
      prompt,
      continuation,
      cwd: config.cwd,
      systemContext: config.systemContext,
      messageId: triggerMessageId,
      inboundMessageIds: processingIds,
    });

    // Process the query while concurrently polling for new messages
    // Publish the batch's in_reply_to so MCP tools (send_message, send_file)
    // can stamp it on outbound rows — needed for a2a return-path routing.
    setCurrentInReplyTo(routing.inReplyTo);
    // Forward a loop stop to the ACTIVE query. The stream deliberately stays
    // open between turns, so the loop can be parked inside processQuery when
    // config.signal fires; without this, the "stopped" loop's query — and its
    // 500ms follow-up poller — outlives the stop and keeps polling (and
    // claiming) messages from whatever inbound DB the process points at. In
    // tests that leaked one immortal poller per loop-driven test, which could
    // steal a later test's follow-up message into a dead query.
    const abortActiveQuery = () => query.abort();
    if (config.signal?.aborted) abortActiveQuery();
    else config.signal?.addEventListener('abort', abortActiveQuery, { once: true });
    try {
      const result = await processQuery(
        query,
        routing,
        processingIds,
        config.providerName,
        config.provider.onExchangeComplete?.bind(config.provider),
        prompt,
        continuation,
      );
      if (result.continuation && result.continuation !== continuation) {
        continuation = result.continuation;
        setContinuation(config.providerName, continuation);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log(`Query error: ${errMsg}`);

      // Stale/corrupt continuation recovery: ask the provider whether
      // this error means the stored continuation is unusable, and clear
      // it so the next attempt starts fresh.
      if (continuation && config.provider.isSessionInvalid(err)) {
        log(`Stale session detected (${continuation}) — clearing for next retry`);
        continuation = undefined;
        clearContinuation(config.providerName);
      }

      // Write error response so the user knows something went wrong
      writeMessageOut({
        id: generateId(),
        kind: 'chat',
        platform_id: routing.platformId,
        channel_type: routing.channelType,
        thread_id: routing.threadId,
        content: JSON.stringify({ text: `Error: ${errMsg}` }),
      });

      // The batch is still acked completed below (no redelivery). Without
      // this line the only log trace of the errored turn is "Query error"
      // followed by a "Completed" line that reads like success.
      log(`Errored batch will be acked completed — ${processingIds.length} message(s), no redelivery`);
    } finally {
      clearCurrentInReplyTo();
      config.signal?.removeEventListener('abort', abortActiveQuery);
    }

    // Ensure completed even if processQuery ended without a result event
    // (e.g. stream closed unexpectedly).
    markCompleted(processingIds);
    log(`Completed ${batchSize} message(s)`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { isCorruptionError, processQuery } from './poll-query.js';
export { autoAppendTaskLog, buildTaskBlockNudge, dispatchResultText, shouldNudgeTaskBlocks } from './message-dispatch.js';
export type { TaskMessageBlock } from './message-dispatch.js';
