/**
 * Canonical thread/session selection rules for all NanoClaw UIs.
 * Swift mirror: clients/macos/Sources/BaraoApp/Utils/ThreadSelectionResolver.swift
 */

export type ThreadStatus = 'active' | 'archived' | string;

export interface SelectableThread {
  sessionId: string;
  status: ThreadStatus;
}

export function pickDefaultSessionId<T extends SelectableThread>(threads: T[]): string | null {
  if (threads.length === 0) return null;
  const active = threads.find((t) => t.status === 'active');
  return (active ?? threads[0]).sessionId;
}

/**
 * Keep the current selection only when it still points to an active session.
 * Otherwise follow the platform's current active session (or first listed).
 */
export function resolveSelectedSessionId<T extends SelectableThread>(
  threads: T[],
  current: string | null | undefined,
): string | null {
  if (current) {
    const selected = threads.find((t) => t.sessionId === current);
    if (selected?.status === 'active') return current;
  }
  return pickDefaultSessionId(threads);
}
