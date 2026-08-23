/**
 * Node-side client for the Bun orchestrator subprocess.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

import type {
  OrchestratorTurnRequest,
  OrchestratorTurnResult,
  SyncTurnRunnerRequest,
} from './sync-turn-types.js';

const SYNC_TURN_TIMEOUT_MS = 300_000;

interface RunnerOk<T> {
  ok: true;
  result: T;
}

interface RunnerErr {
  ok: false;
  error: string;
}

type RunnerResponse<T> = RunnerOk<T> | RunnerErr;

async function invokeBunRunner<T>(payload: SyncTurnRunnerRequest): Promise<T> {
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
        const parsed = JSON.parse(line) as RunnerResponse<T>;
        if (!parsed.ok) {
          reject(new Error(parsed.error || 'Falha no subprocesso sync-turn.'));
          return;
        }
        resolve(parsed.result);
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

export function invokeOrchestratorTurn(request: OrchestratorTurnRequest): Promise<OrchestratorTurnResult> {
  return invokeBunRunner<OrchestratorTurnResult>({ op: 'orchestrate', orchestrate: request });
}
