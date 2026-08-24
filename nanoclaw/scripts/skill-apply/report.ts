// Diagnosis helpers over an ApplyResult — what a driver reports to the operator.

import type { ApplyResult } from './types.js';

/**
 * True when a skill applied completely — nothing deferred for a missing input and
 * nothing bounced to an agent. The check a programmatic caller makes to confirm a
 * fully-headless run-through succeeded.
 */
export function fullyApplied(res: ApplyResult): boolean {
  return res.deferred.length === 0 && res.agentTasks.length === 0;
}

/**
 * The failure diagnosis for the FIRST directive that bounced to an agent, in
 * document order: a concise headline (the nearest section heading) plus the
 * bounced step's own prose as the hint. The setup driver surfaces this when a
 * channel skill doesn't fully apply — the prose beside the step that failed
 * becomes the operator's failure hint and the Claude-handoff context, instead
 * of a generic "couldn't finish" message. Returns undefined when nothing
 * bounced (e.g. a headless rebuild only left prompts deferred — not a failure).
 */
export function firstFailureHint(res: ApplyResult): { headline: string; hint: string } | undefined {
  const first = res.agentTasks[0];
  if (!first) return undefined;
  const hint = first.prose.trim();
  // The concise headline: the nearest `#`-heading the prose carries, stripped of
  // its markers; failing that, the first prose line; failing that, the reason.
  const lines = first.prose
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const heading = lines.find((l) => l.startsWith('#'));
  const headline = heading ? heading.replace(/^#+\s*/, '').trim() : (lines[0] ?? first.reason);
  return { headline, hint };
}
