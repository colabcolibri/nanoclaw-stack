import { getAllDestinations } from '../../destinations.js';

// Steers the model rather than just silently declining: nothing in this
// container can answer an interactive question, so tell it to decide on its
// own or fall back to nanoclaw's own blocking MCP tool (mcp-tools/interactive.ts,
// registered as `ask_user_question`), which actually reaches the human through
// the chat channel instead of OpenCode's headless-dead-end question tool.
export const QUESTION_STEERING_TEXT =
  'Interactive questions are not available in this environment. Decide autonomously based on your best judgment, or use the ask_user_question MCP tool to ask the human through the chat channel.';

/**
 * Routing-discipline reminder injected on the first prompt AFTER OpenCode
 * auto-compacts the active session. Compaction rewrites the transcript into a
 * summary, and the delivery contract — every reply that should reach a human
 * must be wrapped in <message to="name">…</message> blocks, which the poll-loop
 * enforces when it dispatches the agent's final text — is exactly the kind of
 * standing instruction a summary can quietly drop. Once it is gone, replies
 * stop reaching anyone. Re-state it, with the live destination list, so the
 * next turn routes correctly.
 *
 * OpenCode 1.4.11 (the pinned SDK) exposes no compaction-prompt /
 * customInstructions API — the Config type has no such key and session
 * summarization takes only providerID + modelID — so unlike the Claude
 * provider's PreCompact hook we cannot steer the summary itself. We re-inject
 * on the next prompt instead. Destinations are read fresh at injection time.
 *
 * NB: on this providers branch there is no shared buildCompactInstructions()
 * helper to reuse (it and the task-series model it depends on land far ahead on
 * main), so this reminder states the branch's own <message to> discipline
 * rather than importing text that does not exist here.
 */
export function buildPostCompactionReminder(names: string[] = getAllDestinations().map((d) => d.name)): string {
  const list = names.length > 0 ? names.map((n) => `\`${n}\``).join(', ') : '(none)';
  return (
    '<system>The conversation was just compacted into a summary. Routing instructions can be lost in ' +
    'that summary, so as a reminder: wrap every reply you want delivered in ' +
    '<message to="name">…</message> blocks — text outside such blocks is treated as scratchpad and is ' +
    `NOT sent. Available destinations: ${list}.</system>`
  );
}

/**
 * Per-query compaction-reminder latch. `note` arms it when a
 * `session.compacted` event names the turn's active session — the OpenCode
 * server is shared across sessions, so an unrelated session's compaction must
 * never arm this query's reminder. `apply` prepends the reminder to the next
 * prompt exactly once, then disarms. `buildReminder` is injectable so tests can
 * drive the latch without touching the destinations DB.
 */
export function createCompactionReminder(buildReminder: () => string = buildPostCompactionReminder): {
  note(eventSessionId: string | undefined, activeSessionId: string | undefined): void;
  apply(message: string): string;
  readonly isArmed: boolean;
} {
  let armed = false;
  return {
    note(eventSessionId, activeSessionId) {
      if (activeSessionId !== undefined && eventSessionId === activeSessionId) armed = true;
    },
    apply(message) {
      if (!armed) return message;
      armed = false;
      return `${buildReminder()}\n\n${message}`;
    },
    get isArmed() {
      return armed;
    },
  };
}
