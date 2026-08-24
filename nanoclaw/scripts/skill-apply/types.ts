// The skill application engine's public contract — the types consumers program
// against. Implementation lives in the sibling modules; `scripts/skill-apply.ts`
// is the facade that re-exports these.

// What an `nc:prompt` DECLARES about the value it needs — the core seam's input
// contract, passed to `resolveInput` so a consumer can run its OWN re-ask loop
// (clack validate, a chat exchange). Declaration only: how the value is
// ACQUIRED (a masked TTY prompt, a chat message) is the consumer's business.
export interface InputMeta {
  question: string; // the prompt body (verbatim)
  secret: boolean; // consumer must mask
  validate?: string; // regex source (nc:prompt validate:<re>)
  flags?: string; // regex flags   (nc:prompt flags:<f>)
  normalize?: 'trim' | 'rstrip-slash' | 'lower'; // applied by the ENGINE at bind
}

// Everything the engine EMITS — the core seam's output contract. Every
// `onEvent` call is AWAITED before the engine proceeds; that ordering guarantee
// is what lets a consumer implement gating (hold the operator event until the
// human confirms readiness). For step events, `label` is `stepLabel`'s
// declaration: null means the step is instant/cheap, OR it renders its own live
// operator-facing output (an `effect:step` QR card / pairing code) — a
// step-cost/interactivity declaration, not render advice; the event carries
// `kind` + `line`, so a consumer wanting a different render policy can derive
// its own.
export type ApplyEvent =
  | { type: 'step-start'; kind: string; line: number; label: string | null }
  | {
      type: 'step-end';
      kind: string;
      line: number;
      label: string | null;
      ok: boolean;
      durationMs: number;
      error?: string;
    }
  | { type: 'operator'; line: number; text: string };
// operator: text = the rendered, {{var}}-substituted block body;
//           line = the directive's opening-fence line (keys driver policy maps)

// The result of a streaming `nc:run effect:step`: the spawn's exit success plus
// the terminal status block's fields, which `capture:<var>=<FIELD>` binds.
export interface StepOutcome {
  ok: boolean;
  fields: Record<string, string>;
}

export type StepStatus = 'skip' | 'apply' | 'needs-input' | 'agent';
export interface PlanStep {
  n: number;
  kind: string;
  line: number;
  status: StepStatus;
  detail: string;
}

export type JournalEntry =
  | { op: 'wrote'; path: string }
  | { op: 'appended'; path: string; line: string }
  | { op: 'set-env'; key: string }
  | { op: 'json-merge'; path: string; key: string; value: unknown }
  | { op: 'ran'; cmd: string; undo?: string };

export interface AgentTask {
  kind: string;
  line: number;
  reason: string;
  prose: string; // the surrounding prose the agent reads to apply the step
}

export interface ApplyResult {
  applied: string[];
  skipped: string[];
  deferred: string[]; // prompt vars / blocked consumers with no value yet
  agentTasks: AgentTask[]; // bounced to an agent — NOT the human
  operatorMessages: string[]; // `nc:operator` bodies to relay to the human operator
  // Non-secret resolved values (prompt answers + `run capture:<var>` outputs) so
  // a caller can read what the skill produced — e.g. a channel skill resolves
  // `owner_handle` + `platform_id`, the setup flow reads them to wire the agent.
  vars: Record<string, string>;
  journal: JournalEntry[];
  // The skill's author-written REFERENCE floor — its `## Alternatives`,
  // `## Optional configuration`, and `## Troubleshooting` sections, sliced
  // verbatim from the RAW markdown (see `referenceProse`). The driver surfaces
  // this beside the agentTasks on a bounce: the same prose a human reader would
  // scroll to when a step doesn't apply cleanly. Sliced on the author headings,
  // never the resolved {{var}} map, so a resolved {{secret}} can never leak in.
  referenceProse: string;
}

export interface ApplyOptions {
  // Pre-supplied answers for `prompt` vars (var name → value). Checked FIRST, so
  // a caller that has every answer needs no resolver at all and the whole skill
  // runs through with no human interaction (fully programmatic apply).
  inputs?: Record<string, string>;
  // The core input seam: resolve a prompt var the caller didn't pre-supply.
  // `meta` carries the declared semantics (question, secret,
  // validate/flags/normalize) so a consumer can run its OWN re-ask loop.
  // Returning undefined ⇒ defer. Optional — omit it (with full `inputs`) for a
  // headless run; a prompt with neither defers.
  resolveInput?: (name: string, meta: InputMeta) => Promise<string | undefined>;
  // The core output seam: every engine emission — the step-start/step-end
  // brackets and each rendered `nc:operator` block — flows through this one
  // handler, and every call is AWAITED before the engine proceeds (that
  // ordering is what lets a consumer gate on an operator block). A rejection is
  // treated like any other throw at that directive: bounce, never crash — a
  // consumer that throws on an operator event accepts the bounce consequence,
  // including the `blocked` latch cascading over later side effects. Absent ⇒
  // silent; the headless/programmatic apply runs identically.
  onEvent?: (e: ApplyEvent) => void | Promise<void>;
  // dep/run/branch-fetch; injectable for tests. Returns the command's stdout so
  // a `run capture:<var>` can bind it into a {{var}} (the twin of `prompt`).
  exec?: (cmd: string) => string | void | Promise<string | void>;
  // Streaming exec for `nc:run effect:step`: spawns a long-running, operator-
  // interactive step (a pairing code, a QR device-link) that emits
  // `=== NANOCLAW SETUP: … ===` status blocks, renders them to the operator live,
  // and resolves with the terminal block's fields (bound via capture:<var>=<FIELD>).
  // Absent ⇒ a step directive degrades to an agent (runs the step from the prose).
  execStream?: (cmd: string) => Promise<StepOutcome>;
  // Run effects the CALLER owns and will perform itself — those runs are skipped
  // (not executed). e.g. a headless rebuild or a setup that restarts once at the
  // end passes ['restart']; applyProviderSkill passes ['build','test'].
  skipEffects?: string[];
  // Resolve which remote carries a `from-branch` registry branch. Defaults to a
  // generic resolver (env override → first remote that has the branch → origin);
  // setup injects one that reuses setup/lib/channels-remote.sh for exact parity.
  resolveRemote?: (branch: string) => string;
}
