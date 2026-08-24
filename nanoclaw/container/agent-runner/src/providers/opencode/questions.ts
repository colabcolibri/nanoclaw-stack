import { QUESTION_STEERING_TEXT } from './compaction.js';
import { log } from './shared.js';

/**
 * Minimal shape of the `/v2` SDK surface this module needs for question
 * handling — narrowed so tests can pass a fake without pulling in the real
 * `@opencode-ai/sdk/v2` client.
 */
export interface QuestionClient {
  question: {
    reply(params: { requestID: string; answers: string[][] }): Promise<{ data?: unknown; error?: unknown }>;
    list(): Promise<{ data?: Array<{ id: string; sessionID?: string; questions?: unknown[] }>; error?: unknown }>;
  };
}

/**
 * Answer a single pending question request with the steering text, one
 * custom answer per sub-question (OpenCode's `question` tool defaults
 * `custom: true`, i.e. an answer string that isn't one of the offered
 * option labels is accepted as free text). Never throws — a failed
 * auto-answer should not take down the session any more than the question
 * already threatened to.
 */

export async function autoAnswerQuestion(
  questionClient: QuestionClient,
  req: { id?: string; questions?: unknown[] },
): Promise<void> {
  if (!req.id) return;
  const count = Array.isArray(req.questions) && req.questions.length > 0 ? req.questions.length : 1;
  try {
    const res = await questionClient.question.reply({
      requestID: req.id,
      answers: Array.from({ length: count }, () => [QUESTION_STEERING_TEXT]),
    });
    if (res.error) {
      log(`Failed to auto-answer question ${req.id}: ${JSON.stringify(res.error)}`);
    }
  } catch (err) {
    log(`Failed to auto-answer question ${req.id}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Matches the startup-blocking budget `spawnOpencodeServer` already uses for
 * its own default `timeoutMs`. This is a startup-path call like that one, so
 * it gets the same allowance. Shared with `handleQuestionAsked` below — the
 * same fail-open budget applies whether a hung reply is discovered at
 * runtime startup or mid-turn.
 */
const DRAIN_PENDING_QUESTIONS_TIMEOUT_MS = 10_000;

/**
 * Handle a `question.asked` SSE event: always answer it, regardless of which
 * session raised it. The `question: 'deny'` config above should stop this
 * tool from ever firing, but this is the real fix for the wedge: the
 * OpenCode server is shared across every session on this runtime, and a
 * pending question wedges the whole server, not just the session that asked
 * — so a config regression or an OpenCode-side path that raises the event
 * before consulting permission must never be able to leave a question
 * unanswered, no matter whose sessionID it carries. Same rule as
 * `drainPendingQuestions`, so behavior does not depend on which path sees a
 * question first.
 *
 * Bounded the same way `drainPendingQuestions` bounds its own await: this is
 * called inline from the turn's event loop (the `question.asked` case
 * below), so a `reply()` that never resolves would stall the turn, not just
 * startup. `timeoutMs` is injectable so tests don't wait out the real
 * default; on timeout this logs one line and returns, fail-open, same as the
 * drain path.
 */
export async function handleQuestionAsked(
  questionClient: QuestionClient,
  req: { id?: string; sessionID?: string; questions?: unknown[] },
  timeoutMs = DRAIN_PENDING_QUESTIONS_TIMEOUT_MS,
): Promise<void> {
  log(`Auto-answering question ${req.id ?? '(no id)'} (sessionID=${req.sessionID ?? 'unknown'})`);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<true>((resolve) => {
    timer = setTimeout(() => resolve(true), timeoutMs);
  });

  try {
    if (await Promise.race([autoAnswerQuestion(questionClient, req).then(() => false as const), timedOut])) {
      log(`Timed out after ${timeoutMs}ms auto-answering question ${req.id ?? '(no id)'}; continuing`);
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Defensive belt: drain any question requests already pending when a shared
 * runtime comes up (e.g. one that raced the event subscription, or survived
 * from a prior server instance) so none of them can sit there wedging future
 * turns before the event-driven handler ever sees them.
 *
 * Bounded the same way `spawnOpencodeServer` bounds its own await: a plain
 * `Promise.race` against a timer, since (unlike that function's child-process
 * spawn) there is no cancellable handle on the in-flight SDK calls to abort.
 * A hung list()/reply() round-trip must not block runtime startup forever —
 * on timeout this logs one line and returns, fail-open, because the
 * event-driven `question.asked` handler still answers the question later if
 * the round-trip eventually completes.
 */
export async function drainPendingQuestions(
  questionClient: QuestionClient,
  timeoutMs = DRAIN_PENDING_QUESTIONS_TIMEOUT_MS,
): Promise<void> {
  const drain = (async () => {
    try {
      const res = await questionClient.question.list();
      if (res.error) {
        log(`Failed to list pending questions: ${JSON.stringify(res.error)}`);
        return;
      }
      for (const req of res.data ?? []) {
        await autoAnswerQuestion(questionClient, req);
      }
    } catch (err) {
      log(`Failed to list pending questions: ${err instanceof Error ? err.message : String(err)}`);
    }
  })();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<true>((resolve) => {
    timer = setTimeout(() => resolve(true), timeoutMs);
  });

  try {
    if (await Promise.race([drain.then(() => false as const), timedOut])) {
      log(`Timed out after ${timeoutMs}ms draining pending questions; continuing startup`);
    }
  } finally {
    // A fast drain resolves before the timer fires, but the timer stays live
    // until it does — clear it here so it can't hold this call alive or fire
    // spuriously into a `timedOut` promise no one is racing against anymore.
    clearTimeout(timer);
  }
}
