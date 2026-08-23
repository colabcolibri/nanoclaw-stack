import { ensureCentralDb } from '../db/ensure-central-db.js';
import { log } from '../log.js';

let workerBootstrapped = false;

/**
 * Bootstraps a sync-turn worker process (Bun subprocess or in-process Bun).
 *
 * Contract:
 * - Opens the same central DB as the Node host (`data/v2.db`).
 * - Safe to call multiple times (idempotent per process).
 * - Must run before any getDb() in sync-turn code paths.
 *
 * The Node motor host calls initDb() in main(); this covers worker entry points only.
 */
export function bootstrapSyncTurnWorker(): void {
  if (workerBootstrapped) return;

  ensureCentralDb();
  workerBootstrapped = true;
  log.info('Sync-turn worker ready', {
    pid: process.pid,
    runtime: typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined' ? 'bun' : 'node',
  });
}
