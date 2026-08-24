// The skill application engine — executes `nc:` directives parsed from a SKILL.md.
//
// The agent is always the top-level applier; this engine is the deterministic
// accelerator it delegates to. Anything the engine can't do bounces back to the
// AGENT (which reads the same prose and applies it, the way skills work today) —
// never to the human, and never as a hard abort. The human is in the loop only
// for `prompt` inputs and `operator` instructions — the parts addressed to the
// human (e.g. clicking through the Slack UI), which the agent relays.
//
// Phases (the F2 runtime contract, minimal form):
//   1. parse + validate   — lint; a malformed skill never reaches apply
//   2. PLAN               — per directive: skip|apply|needs-input|agent — no writes
//   3. acquire inputs     — resolve every `prompt` via `inputs` / `resolveInput`
//   4. mutate             — copy/append/env-set, journaled + idempotent
//   5. run                — build/test/fetch (+ dep install) via injected exec
// Remove is derived from the journal — no hand-written REMOVE.md.
//
// Inputs + `resolveInput` make one engine serve three contexts:
//   • programmatic    → pass `inputs` (var→value); no resolver, runs through fully
//   • setup flow      → an interactive `resolveInput` collects anything left
//   • recipe rebuild  → headless: no answer for a prompt ⇒ it (and its consumers) defer
//
// Implementation lives in scripts/skill-apply/; this file is the facade plus the
// CLI entrypoint.
//
// Usage: pnpm exec tsx scripts/skill-apply.ts <skillDir>     # plan (no writes)

export type {
  ApplyEvent,
  ApplyOptions,
  ApplyResult,
  AgentTask,
  InputMeta,
  JournalEntry,
  PlanStep,
  StepOutcome,
  StepStatus,
} from './skill-apply/types.js';
export { planSkill } from './skill-apply/plan.js';
export { referenceProse, stepLabel } from './skill-apply/prose.js';
export { normalizeValue } from './skill-apply/vars.js';
export { fullyApplied, firstFailureHint } from './skill-apply/report.js';
export { applySkill, removeSkill } from './skill-apply/engine.js';

import type { StepStatus } from './skill-apply/types.js';
import { planSkill } from './skill-apply/plan.js';

// CLI — the planner (no writes)
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const skillDir = process.argv[2];
  if (!skillDir) {
    console.error('usage: pnpm exec tsx scripts/skill-apply.ts <skillDir>');
    process.exit(2);
  }
  const root = process.cwd();
  const { steps, needsInput, agentSteps } = planSkill(skillDir, root);
  console.log(`PLAN ${skillDir}   project: ${root}\n`);
  const icon: Record<StepStatus, string> = {
    skip: '✓ skip',
    apply: '→ apply',
    'needs-input': '? human',
    agent: '↳ agent',
  };
  for (const s of steps)
    console.log(`${String(s.n).padStart(2)}. ${icon[s.status].padEnd(8)} ${s.kind.padEnd(9)} ${s.detail}`);
  console.log(`\nneeds human input: ${needsInput.join(', ') || '(none)'}    →agent: ${agentSteps}`);
}
