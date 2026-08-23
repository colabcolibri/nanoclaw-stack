/**
 * Sync-turn entry for macOS / UI proxy channels.
 * Node motor delegates to Bun (agent-runner uses bun:sqlite); runs in-process when already on Bun.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

import type {
  SyncChannel,
  SyncResetResult,
  SyncTurnInput,
  SyncTurnResult,
} from './sync-turn-gateway-impl.js';

export type { SyncChannel, SyncResetResult, SyncTurnInput, SyncTurnResult };

const SYNC_TURN_TIMEOUT_MS = 300_000;

function runsOnBun(): boolean {
  return typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined';
}

interface RunnerOkTurn {
  ok: true;
  result: SyncTurnResult;
}

interface RunnerOkReset {
  ok: true;
  result: SyncResetResult;
}

interface RunnerErr {
  ok: false;
  error: string;
}

type RunnerResponse = RunnerOkTurn | RunnerOkReset | RunnerErr;

async function invokeBunRunner<T>(payload: Record<string, unknown>): Promise<T> {
  const projectRoot = process.cwd();
  const scriptPath = path.join(projectRoot, 'scripts', 'sync-turn-runner.ts');
  const bunBin = process.env.BUN_BIN?.trim() || 'bun';

  return new Promise((resolve, reject) => {
    const child = spawn(bunBin, ['run', scriptPath], {
      cwd: projectRoot,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Turn sync excedeu o tempo limite (5 min).'));
    }, SYNC_TURN_TIMEOUT_MS);

    child.on('error', (err) => {
      clearTimeout(timer);
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        reject(
          new Error(
            `Bun não encontrado (${bunBin}). Instale Bun — o canal Mac precisa do runtime Bun para o orquestrador.`,
          ),
        );
        return;
      }
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const line = stdout.trim().split('\n').pop() || '';
      try {
        const parsed = JSON.parse(line) as RunnerResponse;
        if (!parsed.ok) {
          reject(new Error(parsed.error || 'Falha no subprocesso sync-turn.'));
          return;
        }
        if ('result' in parsed && parsed.result !== undefined) {
          resolve(parsed.result as T);
          return;
        }
        reject(new Error('Resposta incompleta do subprocesso sync-turn.'));
      } catch {
        const detail = stderr.trim() || stdout.trim();
        if (code !== 0 || detail) {
          reject(new Error(detail || `sync-turn subprocess exit ${code}`));
          return;
        }
        reject(new Error('Resposta inválida do subprocesso sync-turn.'));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export async function processSyncTurn(input: SyncTurnInput): Promise<SyncTurnResult> {
  if (runsOnBun()) {
    const impl = await import('./sync-turn-gateway-impl.js');
    return impl.processSyncTurn(input);
  }
  return invokeBunRunner<SyncTurnResult>({ op: 'turn', input });
}

export async function resetSyncSession(
  channel: SyncChannel,
  groupFolder: string,
  userId = 'default',
  mode: 'new' | 'new-resume' = 'new',
): Promise<SyncResetResult> {
  if (runsOnBun()) {
    const impl = await import('./sync-turn-gateway-impl.js');
    return impl.resetSyncSession(channel, groupFolder, userId, mode);
  }
  return invokeBunRunner<SyncResetResult>({ op: 'reset', channel, groupFolder, userId, mode });
}
