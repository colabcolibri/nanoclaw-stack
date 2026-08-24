export function log(msg: string): void {
  console.error(`[opencode-provider] ${msg}`);
}

/** Após N tentativas de retry reportadas pelo session.status, falha o turno. */
export const SESSION_STATUS_RETRY_ERROR_AFTER = 3;

/** Stale / dead OpenCode session heuristics (complement Claude-centric host patterns). */
export const STALE_SESSION_RE =
  /no conversation found|ENOENT.*\.jsonl|session.*not found|NotFoundError|connection reset|ECONNRESET|404|event timeout/i;

export function sessionErrorMessage(props: { error?: unknown }): string {
  const err = props.error as { data?: { message?: string } } | undefined;
  if (err && typeof err === 'object' && err.data && typeof err.data.message === 'string') {
    return err.data.message;
  }
  return JSON.stringify(props.error) || 'OpenCode session error';
}
