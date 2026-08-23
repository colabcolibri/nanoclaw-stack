/**
 * Bun subprocess entry for sync-turn (Node motor cannot load bun:sqlite from agent-runner).
 * stdin: JSON { op: 'turn', input } | { op: 'reset', channel, groupFolder, userId?, mode? }
 * stdout: single JSON line { ok, result? | error? }
 */
import { bootstrapSyncTurnWorker } from '../src/gateway/sync-turn-bootstrap.ts';
import {
  processSyncTurn,
  resetSyncSession,
  type SyncChannel,
  type SyncTurnInput,
} from '../src/gateway/sync-turn-gateway-impl.ts';

function emit(body: Record<string, unknown>): void {
  console.log(JSON.stringify(body));
}

async function main(): Promise<void> {
  bootstrapSyncTurnWorker();

  const raw = await Bun.stdin.text();
  const req = JSON.parse(raw.trim() || '{}') as {
    op?: string;
    input?: SyncTurnInput;
    channel?: SyncChannel;
    groupFolder?: string;
    userId?: string;
    mode?: 'new' | 'new-resume';
  };

  if (req.op === 'turn' && req.input) {
    const result = await processSyncTurn(req.input);
    emit({ ok: true, result });
    return;
  }

  if (req.op === 'reset' && req.channel && req.groupFolder) {
    const result = await resetSyncSession(
      req.channel,
      req.groupFolder,
      req.userId ?? 'default',
      req.mode ?? 'new',
    );
    emit({ ok: true, result });
    return;
  }

  emit({ ok: false, error: 'Payload inválido para sync-turn-runner.' });
  process.exit(1);
}

try {
  await main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  emit({ ok: false, error: message });
  process.exit(1);
}
