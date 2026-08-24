import { spawn, type ChildProcess } from 'child_process';

import { createOpencodeClient, type OpencodeClient } from '@opencode-ai/sdk';
import { createOpencodeClient as createOpencodeQuestionClient } from '@opencode-ai/sdk/v2';

import { mcpServersToOpenCodeConfig } from '../mcp-to-opencode.js';
import type { ProviderOptions } from '../types.js';
import { log, SESSION_STATUS_RETRY_ERROR_AFTER } from './shared.js';
import { buildOpenCodeConfig } from './config.js';
import { drainPendingQuestions, type QuestionClient } from './questions.js';

// Constante pertence ao contrato de retry do stream de eventos (usada pela classe).
export { SESSION_STATUS_RETRY_ERROR_AFTER };

function killProcessTree(proc: ChildProcess): void {
  if (!proc.pid) return;
  try {
    process.kill(-proc.pid, 'SIGKILL');
  } catch {
    try {
      proc.kill('SIGKILL');
    } catch {
      /* ignore */
    }
  }
}

function spawnOpencodeServer(
  config: Record<string, unknown>,
  timeoutMs = 10_000,
): Promise<{ url: string; proc: ChildProcess }> {
  return new Promise((resolve, reject) => {
    const hostname = '127.0.0.1';
    const port = 4096;
    const proc = spawn('opencode', ['serve', `--hostname=${hostname}`, `--port=${port}`], {
      env: {
        ...process.env,
        OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
      },
      detached: true,
    });

    const id = setTimeout(() => {
      killProcessTree(proc);
      reject(new Error(`Timeout waiting for OpenCode server to start after ${timeoutMs}ms`));
    }, timeoutMs);

    let output = '';
    proc.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      for (const line of output.split('\n')) {
        if (line.startsWith('opencode server listening')) {
          const match = line.match(/on\s+(https?:\/\/[^\s]+)/);
          if (match) {
            clearTimeout(id);
            resolve({ url: match[1], proc });
          }
        }
      }
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    proc.on('exit', (code) => {
      clearTimeout(id);
      let msg = `OpenCode server exited with code ${code}`;
      if (output.trim()) msg += `\nServer output: ${output}`;
      reject(new Error(msg));
    });
    proc.on('error', (err) => {
      clearTimeout(id);
      reject(err);
    });
  });
}

export type SharedRuntime = {
  proc: ChildProcess;
  client: OpencodeClient;
  questionClient: QuestionClient;
  stream: AsyncGenerator<{ type: string; properties: Record<string, unknown> }, void, void>;
  streamRelease: () => void;
};

let sharedRuntime: SharedRuntime | null = null;
let sharedConfigKey: string | null = null;
let sharedInit: Promise<SharedRuntime> | null = null;

function runtimeConfigKey(options: ProviderOptions): string {
  return JSON.stringify({
    mcp: mcpServersToOpenCodeConfig(options.mcpServers),
    model: process.env.OPENCODE_MODEL,
    small: process.env.OPENCODE_SMALL_MODEL,
    op: process.env.OPENCODE_PROVIDER,
  });
}

export async function ensureSharedRuntime(options: ProviderOptions): Promise<SharedRuntime> {
  const key = runtimeConfigKey(options);
  if (sharedRuntime && sharedConfigKey === key) return sharedRuntime;

  if (sharedInit) return sharedInit;

  sharedInit = (async () => {
    if (sharedRuntime) {
      destroySharedRuntime();
    }
    const config = buildOpenCodeConfig(options);
    const { url, proc } = await spawnOpencodeServer(config);
    const client = createOpencodeClient({ baseUrl: url });
    const questionClient = createOpencodeQuestionClient({ baseUrl: url });
    const sub = await client.event.subscribe();
    const stream = sub.stream as AsyncGenerator<{ type: string; properties: Record<string, unknown> }, void, void>;
    // Belt-and-suspenders drain before this runtime serves any turn — see
    // drainPendingQuestions doc comment.
    await drainPendingQuestions(questionClient);
    sharedRuntime = {
      proc,
      client,
      questionClient,
      stream,
      streamRelease: () => {
        void stream.return?.(undefined);
      },
    };
    sharedConfigKey = key;
    sharedInit = null;
    return sharedRuntime;
  })();

  return sharedInit;
}

export function destroySharedRuntime(): void {
  if (sharedRuntime) {
    try {
      sharedRuntime.streamRelease();
    } catch {
      /* ignore */
    }
    killProcessTree(sharedRuntime.proc);
    sharedRuntime = null;
    sharedConfigKey = null;
  }
  sharedInit = null;
}
