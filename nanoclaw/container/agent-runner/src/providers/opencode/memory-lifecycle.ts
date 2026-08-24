import { spawnSync } from 'child_process';

import { log } from './shared.js';

/**
 * Structural mirror of the runner's `MemorySessionHookRegistration`
 * (`container/agent-runner/src/memory/session-hook.ts`). Declared locally for
 * the same reason `codex-app-server.ts` declares `CodexMemorySessionHook`: this
 * providers branch carries no `src/memory/*`, so importing the real type would
 * not compile here, while a structural copy still satisfies the interface once
 * this payload is installed onto a main-based tree. The command is referenced
 * by string and executed as a subprocess — never imported — so the rendering
 * and the 16k/file caps stay inside the shared hook.
 */
/**
 * The two lifecycle points at which this provider establishes a new context
 * window. `clear` never appears: OpenCode has no in-session clear — a cleared
 * conversation arrives as a fresh session, i.e. `startup`. `resume` never
 * appears either, by contract: memory is not re-injected when an existing
 * session continues.
 */
export type OpenCodeMemorySource = 'startup' | 'compact';

export interface OpenCodeMemorySessionHook {
  readonly command: string;
  readonly legacyCommands: readonly string[];
  readonly sources: readonly string[];
}

/** Matches the `timeout: 10` (seconds) the Claude provider registers for the same command. */
const MEMORY_HOOK_TIMEOUT_MS = 10_000;

/**
 * Run the registered memory session hook and return what it printed.
 *
 * The hook reads a Claude-style SessionStart payload on stdin and prints the
 * rendered memory section on stdout (`src/memory/hook.ts`), which is where the
 * per-file caps and the "resume gets nothing" rule live. Nothing is capped or
 * rewritten here — whatever the command prints is what gets injected.
 *
 * Fails closed on every failure mode (unregistered, source the registration
 * does not declare, missing command, non-zero exit, timeout, empty stdout):
 * one log line, no injection, never a thrown turn.
 */
export function runMemorySessionHook(
  hook: OpenCodeMemorySessionHook | undefined,
  source: OpenCodeMemorySource,
): string | undefined {
  if (!hook) {
    log(`No memory session hook registered; skipping ${source} memory injection`);
    return undefined;
  }
  if (!hook.sources.includes(source)) {
    log(`Memory session hook does not declare source ${source}; skipping injection`);
    return undefined;
  }

  try {
    const res = spawnSync(hook.command, {
      shell: true,
      input: JSON.stringify({ hook_event_name: 'SessionStart', source }),
      encoding: 'utf-8',
      timeout: MEMORY_HOOK_TIMEOUT_MS,
    });
    if (res.error || res.status !== 0) {
      const why = res.error ? res.error.message : `exit ${String(res.status)}`;
      log(`Memory session hook (${source}) failed (${why}); continuing without memory`);
      return undefined;
    }
    const out = (res.stdout ?? '').trim();
    if (!out) {
      log(`Memory session hook (${source}) produced no output; continuing without memory`);
      return undefined;
    }
    return out;
  } catch (err) {
    log(`Memory session hook (${source}) failed: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

/**
 * Per-query memory lifecycle. One instance per `query()`, mirroring
 * createCompactionReminder, so nothing leaks between queries.
 *
 * `openingInstructions` covers the new-context case: an opening query with no
 * continuation is a brand-new OpenCode session (a fresh container and a cleared
 * conversation both land here), so memory joins the system instructions that
 * prompt already carries — exactly one memory block per context window, since
 * follow-up pushes re-send the plain instructions. A query that resumes a
 * continuation passes the instructions through untouched and never runs the
 * command at all.
 *
 * `pushPrefix` covers the other place a context window is rebuilt: OpenCode
 * auto-compaction. The caller passes the compaction latch's armed state, so
 * memory rides the same exactly-once next-prompt slot as the routing reminder.
 */
export function createMemoryLifecycle(
  hook: OpenCodeMemorySessionHook | undefined,
  isResume: boolean,
): {
  openingInstructions(systemInstructions?: string): string | undefined;
  pushPrefix(justCompacted: boolean): string;
} {
  return {
    openingInstructions(systemInstructions) {
      if (isResume) return systemInstructions;
      const memory = runMemorySessionHook(hook, 'startup');
      if (!memory) return systemInstructions;
      return systemInstructions ? `${memory}\n\n${systemInstructions}` : memory;
    },
    pushPrefix(justCompacted) {
      if (!justCompacted) return '';
      const memory = runMemorySessionHook(hook, 'compact');
      return memory ? `${memory}\n\n` : '';
    },
  };
}
