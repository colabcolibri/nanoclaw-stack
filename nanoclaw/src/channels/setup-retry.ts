/**
 * Retry compartilhado para setup de channel adapters.
 *
 * Duas políticas vivem aqui (antes duplicadas em channel-registry.ts e
 * telegram/adapter.ts):
 * 1. retryOnNetworkError — delays fixos, só para erros de rede transitórios
 *    (misconfig continua falhando alto).
 * 2. withExponentialBackoff — backoff exponencial limitado para operações
 *    one-shot de cold-start (DNS hiccups, outages breves).
 */

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Duck-type check — adapters que lançam Error com `name === 'NetworkError'`
 * (Chat SDK's `@chat-adapter/shared.NetworkError` e similares) ganham retry no
 * setup. Evita depender de `@chat-adapter/shared` no nível do trunk. */
export function isNetworkError(err: unknown): err is Error {
  return err instanceof Error && err.name === 'NetworkError';
}

export interface NetworkRetryOptions {
  /** Delays em ms entre tentativas; o tamanho define o máximo de retries. */
  delays: readonly number[];
  onRetry?: (info: { attempt: number; delayMs: number; errMessage: string }) => void;
}

/** Executa `fn` repetindo apenas sobre NetworkError, com delays fixos. */
export async function retryOnNetworkError<T>(fn: () => Promise<T>, opts: NetworkRetryOptions): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (isNetworkError(err) && attempt < opts.delays.length) {
        const delayMs = opts.delays[attempt]!;
        opts.onRetry?.({ attempt: attempt + 1, delayMs, errMessage: err.message });
        await sleep(delayMs);
        attempt += 1;
        continue;
      }
      throw err;
    }
  }
}

export interface BackoffOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  capDelayMs?: number;
  onRetry?: (info: { attempt: number; delayMs: number; err: unknown }) => void;
}

/** Backoff exponencial limitado: min(cap, base * 2^(attempt-1)). */
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  { maxAttempts = 5, baseDelayMs = 1000, capDelayMs = 16_000, onRetry }: BackoffOptions = {},
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts) break;
      const delayMs = Math.min(capDelayMs, baseDelayMs * 2 ** (attempt - 1));
      onRetry?.({ attempt, delayMs, err });
      await sleep(delayMs);
    }
  }
  throw lastErr;
}
