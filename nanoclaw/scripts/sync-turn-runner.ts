/**
 * Bun subprocess — orchestrator only (no central v2.db / better-sqlite3).
 * stdin: JSON SyncTurnRunnerRequest
 * stdout: single JSON line { ok, result? | error? }
 */
import { runOrchestratorTurn } from '../src/gateway/sync-turn-orchestrator-worker.ts';
import type { SyncTurnRunnerRequest } from '../src/gateway/sync-turn-types.ts';

function emit(body: Record<string, unknown>): void {
  console.log(JSON.stringify(body));
}

async function main(): Promise<void> {
  const raw = await Bun.stdin.text();
  const req = JSON.parse(raw.trim() || '{}') as SyncTurnRunnerRequest;

  if (req.op === 'orchestrate' && req.orchestrate) {
    const result = await runOrchestratorTurn(req.orchestrate);
    emit({ ok: true, result });
    return;
  }

  emit({ ok: false, error: 'Invalid payload for sync-turn-runner.' });
  process.exit(1);
}

try {
  await main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  emit({ ok: false, error: message });
  process.exit(1);
}
