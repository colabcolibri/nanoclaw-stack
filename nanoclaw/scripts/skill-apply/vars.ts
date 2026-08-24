// {{var}} binding machinery: deterministic normalization at bind, the prompt
// meta declaration, substitution, `when:` guards, and run-capture binding.

import type { Directive } from '../skill-directives.js';
import type { InputMeta } from './types.js';
import { VAR_REF } from './shared.js';

// Deterministic input normalization applied AT BIND to every prompt value —
// `inputs` AND interactive answers alike — driven by `nc:prompt normalize:<how>`:
//   trim          strip leading/trailing whitespace
//   rstrip-slash  drop trailing slash(es) — a base URL with no trailing path
//   lower         lowercase
// Absent/unknown ⇒ a no-op (lint gates the known set). Doing it here, not in the
// consumer, means a programmatic `inputs` value and a typed answer land identically.
// Exported so the driver's reuse-offer pre-filter (§5.4) tests an `.env` value
// against the SAME normalize-then-validate the engine will apply at bind.
export function normalizeValue(value: string, normalize: string | undefined): string {
  switch (normalize) {
    case 'trim':
      return value.trim();
    case 'rstrip-slash':
      return value.replace(/\/+$/, '');
    case 'lower':
      return value.toLowerCase();
    default:
      return value;
  }
}

// The engine-applied normalize transforms (see `normalizeValue`) — the set
// InputMeta.normalize narrows to. Lint gates authorship to these; an unknown
// value simply isn't declared in the meta (and normalizeValue no-ops on it).
const NORMALIZE_KINDS: ReadonlySet<string> = new Set(['trim', 'rstrip-slash', 'lower']);

// The InputMeta an `nc:prompt` declares — handed to `resolveInput` so a
// consumer can run its own re-ask loop against the same semantics the engine
// enforces at bind. The attrs live on the directive fence, so they're stripped
// along with the fence when a skill degrades to prose — invisible to the agent.
export function inputMetaOf(d: Directive, secret: boolean, validate: string | undefined): InputMeta {
  const meta: InputMeta = { question: d.body.join('\n'), secret };
  if (validate !== undefined) meta.validate = validate;
  if (typeof d.attrs.flags === 'string') meta.flags = d.attrs.flags;
  if (typeof d.attrs.normalize === 'string' && NORMALIZE_KINDS.has(d.attrs.normalize)) {
    meta.normalize = d.attrs.normalize as InputMeta['normalize'];
  }
  return meta;
}

export function substitute(value: string, vars: Map<string, { value: string; secret: boolean }>): string {
  return value.replace(VAR_REF, (_, name) => {
    const v = vars.get(name);
    if (!v) throw new Error(`unresolved {{${name}}}`);
    return v.value;
  });
}

// A `when:<var>=<value>` guard: the directive applies only when an earlier
// prompt/capture bound <var> to exactly <value>. Unmet — including the var still
// unresolved (a deferred prompt) — skips the directive, so a guarded prompt is
// skipped, never deferred. This is how a skill expresses mutually-exclusive
// branches (e.g. local vs remote install mode) in plain document order.
export function whenMet(when: string, vars: Map<string, { value: string; secret: boolean }>): boolean {
  const eq = when.indexOf('=');
  if (eq < 1) return true; // malformed → don't block (lint is the gate)
  return vars.get(when.slice(0, eq).trim())?.value === when.slice(eq + 1).trim();
}

// Resolve a jq-style dot-path (`.id`, `.owner.id`) into a parsed JSON value.
// A missing/non-object hop yields undefined — the caller coerces that to ''.
function dotPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.replace(/^\./, '').split('.').filter(Boolean)) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

// Bind a `run capture:<spec>` from a command's stdout into one or more {{vars}}.
//   • bare `capture:var`           → binds the trimmed stdout as-is (unchanged).
//   • `capture:a=.x,b=.owner.id`   → parses the stdout as JSON and binds each var
//                                     to its dot-path, so ONE API call resolves
//                                     several values (the structured twin of the
//                                     effect:step terminal-block capture — those
//                                     two are distinguished by effect: step reads
//                                     the status block, fetch/external read JSON
//                                     stdout). Unparseable JSON throws → the outer
//                                     catch bounces it to an agent.
// An optional `validate:<re>` is enforced against every bound value; a mismatch
// THROWS so the run bounces to an agent — a command's output has no human to
// re-prompt, so an invalid capture is a real failure, not a re-ask.
export function bindCapture(
  spec: string,
  stdout: string,
  validate: string | undefined,
  vars: Map<string, { value: string; secret: boolean }>,
): void {
  const re = validate ? new RegExp(validate) : undefined;
  const set = (name: string, value: string): void => {
    if (re && !re.test(value)) throw new Error(`captured ${name}="${value}" does not match validate:${validate}`);
    vars.set(name, { value, secret: false });
  };
  if (!spec.includes('=')) {
    set(spec, stdout);
    return;
  }
  const json = JSON.parse(stdout) as unknown; // not JSON → throws → outer catch bounces
  for (const pair of spec.split(',')) {
    const eq = pair.indexOf('=');
    if (eq < 1) continue;
    set(pair.slice(0, eq).trim(), String(dotPath(json, pair.slice(eq + 1).trim()) ?? ''));
  }
}
