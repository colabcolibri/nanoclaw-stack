import { execSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDirectives, promptVar, type Directive } from '../skill-directives.js';
import { read } from './shared.js';
import { selfStatus } from './plan.js';
import { proseFor, referenceProse, stepLabel } from './prose.js';
import { inputMetaOf, normalizeValue, substitute, whenMet } from './vars.js';
import { applyOne } from './mutate.js';
import type { ApplyOptions, ApplyResult, JournalEntry } from './types.js';

// A hardcoded `origin` breaks forks where the registry branch lives on
// `upstream`. Generic mirror of channels-remote.sh: explicit override → the
// first remote that actually has the branch → origin.
function defaultResolveRemote(branch: string, root: string): string {
  const override = process.env.NANOCLAW_CHANNELS_REMOTE;
  if (override) return override;
  const cap = (cmd: string): string => {
    try {
      return execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    } catch {
      return '';
    }
  };
  const remotes = cap('git remote')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const ordered = remotes.includes('origin') ? ['origin', ...remotes.filter((r) => r !== 'origin')] : remotes;
  for (const r of ordered) if (cap(`git ls-remote --heads ${r} ${branch}`).trim()) return r;
  return 'origin';
}

export async function applySkill(skillDir: string, root: string, opts: ApplyOptions): Promise<ApplyResult> {
  // Lint (validate()) is the authoring/CI gate, run before a skill ships — NOT
  // here. Apply is best-effort: an unknown directive (a typo lint should have
  // caught, or one newer than this engine) bounces to an agent, never blocks.
  const md = read(join(skillDir, 'SKILL.md'));
  const directives = parseDirectives(md);
  const exec =
    opts.exec ??
    (() => {
      throw new Error('no exec provided');
    });
  const resolveRemote = opts.resolveRemote ?? ((b: string) => defaultResolveRemote(b, root));
  const vars = new Map<string, { value: string; secret: boolean }>();
  const res: ApplyResult = {
    applied: [],
    skipped: [],
    deferred: [],
    agentTasks: [],
    operatorMessages: [],
    vars: {},
    journal: [],
    referenceProse: referenceProse(md),
  };
  // A run-health gate: once ANY directive bounces to an agent, the skill is no
  // longer in a known-good state, so the dangerous side effects below must not
  // fire on their own — a live restart, an interactive pairing/QR step, or a wire
  // launched after an upstream failure just wastes the operator's time (a doomed
  // QR, a restart that loads a bad credential). `blocked` latches on the first
  // bounce; a later side-effecting run becomes its own bounce so the agent
  // finishes it from the prose once the upstream failure is fixed. A DEFERRED
  // prompt (headless rebuild, no answer) is not a failure — it never bounces, so
  // `blocked` stays false and a later restart remains runnable.
  let blocked = false;
  const SIDE_EFFECTS = new Set(['restart', 'step', 'wire']);
  const bounce = (d: Directive, reason: string) => {
    blocked = true;
    res.agentTasks.push({ kind: d.kind, line: d.line, reason, prose: proseFor(md, d.line) });
  };

  for (const d of directives) {
    // Tracks an in-flight step so the catch can always close a matching
    // step-end (start/end stay balanced even when applyOne throws — a consumer's
    // spinner is never orphaned). Set only after step-start fires.
    let inFlight: { label: string | null; at: number } | null = null;
    try {
      // A `when:<var>=<value>` guard that isn't met skips the directive entirely —
      // before prompt (so a guarded prompt is skipped, never deferred), operator,
      // and run handling. This is how mutually-exclusive branches coexist in one
      // skill while a fully-programmatic apply still completes.
      if (typeof d.attrs.when === 'string' && !whenMet(d.attrs.when, vars)) {
        res.skipped.push(`${d.kind}: when ${d.attrs.when} not met`);
        continue;
      }
      if (d.kind === 'prompt') {
        const v = promptVar(d)!;
        const secret = d.args.includes('secret');
        const validate = typeof d.attrs.validate === 'string' ? d.attrs.validate : undefined;
        const flags = typeof d.attrs.flags === 'string' ? d.attrs.flags : undefined;
        const normalize = typeof d.attrs.normalize === 'string' ? d.attrs.normalize : undefined;
        // Pre-supplied inputs win OUTRIGHT (fully-programmatic apply) — an
        // invalid `inputs` value never falls through to a second acquisition
        // path (validation below rejects it loudly instead). Otherwise resolve
        // via `resolveInput`; still undefined ⇒ defer (headless, no answer).
        let val = opts.inputs?.[v];
        if (val === undefined) val = await opts.resolveInput?.(v, inputMetaOf(d, secret, validate));
        if (val === undefined) {
          res.deferred.push(v);
          continue;
        }
        // normalize:<how> binds DETERMINISTICALLY for both inputs and answers, so
        // an `inputs` value and a typed one land identically (a trailing slash
        // stripped, whitespace trimmed) — see normalizeValue.
        const bound = normalizeValue(val, normalize);
        // Validate-at-bind: `validate:` (+ `flags:`) is DATA validation, enforced
        // on the NORMALIZED value no matter where it came from (normalize-then-
        // validate is normative: a trailing slash is stripped before an anchor
        // check). On a mismatch the var stays UNBOUND and only the var name +
        // regex source land in the deferred entry — never the value, so a secret
        // can't leak. Not an agentTask, not a throw: downstream consumers defer
        // exactly as if the value were never supplied, `fullyApplied` is false,
        // and a pipeline passing a malformed env value fails loudly. The
        // interactive re-ask loop lives in the consumer's `resolveInput`; this is
        // the backstop for programmatic paths.
        if (validate !== undefined && !new RegExp(validate, flags).test(bound)) {
          res.deferred.push(`${v}: invalid value (does not match validate:${validate})`);
          continue;
        }
        vars.set(v, { value: bound, secret });
        continue;
      }
      if (d.kind === 'operator') {
        // Once the run is blocked, walking the human through further manual
        // steps is actively misleading — the side effects those instructions
        // lead up to ("a pairing code is about to appear") have already been
        // gated. Skip: no event (so a consumer's URL offer / readiness confirm
        // never fires), no operatorMessages entry (a failed run's manual-steps
        // report must not include steps predicated on the failed one).
        if (blocked) {
          res.skipped.push('operator: skipped after an earlier failure');
          continue;
        }
        // Always collect the human-facing instructions into the result so a
        // programmatic caller can relay/output them. {{vars}} render so a
        // resolved value can be shown (throws → deferred if a referenced var is
        // unset — the whole block defers before any event fires).
        const text = substitute(d.body.join('\n'), vars);
        res.operatorMessages.push(text);
        // The core seam: emit the rendered block and AWAIT the consumer before
        // evaluating the next directive — that ordering is what lets a consumer
        // gate (hold the event until the human confirms readiness). The engine
        // itself never defers/bounces an operator block; a handler that throws
        // opts into the standard bounce path via the outer catch (including
        // the `blocked` latch over later side effects).
        if (opts.onEvent) await opts.onEvent({ type: 'operator', line: d.line, text });
        res.applied.push(`operator: ${(d.body[0] ?? '').slice(0, 50)}`);
        continue;
      }
      // A run whose effect the caller owns (e.g. restart) is skipped here.
      if (d.kind === 'run' && typeof d.attrs.effect === 'string' && opts.skipEffects?.includes(d.attrs.effect)) {
        res.skipped.push(`run ${d.attrs.effect}: owned by the caller`);
        continue;
      }
      // Run-health gate: after an earlier bounce, never fire a dangerous side
      // effect (a live restart, an interactive pairing/QR step, a wire) on its
      // own — bounce it too so the agent runs it from the prose once the upstream
      // failure is fixed. (A deferred prompt did NOT set `blocked`, so this only
      // trips on a real failure, never a headless rebuild's missing input.)
      if (d.kind === 'run' && typeof d.attrs.effect === 'string' && SIDE_EFFECTS.has(d.attrs.effect) && blocked) {
        bounce(d, 'skipped: an earlier step did not complete — run this from the prose after fixing it');
        continue;
      }
      const st = selfStatus(d, root);
      if (st.status === 'agent') {
        bounce(d, 'no deterministic handler');
        continue;
      }
      if (st.status === 'skip') {
        res.skipped.push(`${d.kind}: ${st.detail}`);
        continue;
      }
      // Bracket the real mutation with step events so a consumer can render
      // progress. `label` null is a step-cost/interactivity declaration (see
      // `stepLabel`). `inFlight` is set only after step-start fires; the ok:true
      // step-end clears it BEFORE its own (awaited) emission, so a consumer
      // throw there never double-closes.
      const label = stepLabel(d, md);
      if (opts.onEvent) await opts.onEvent({ type: 'step-start', kind: d.kind, line: d.line, label });
      inFlight = { label, at: Date.now() };
      await applyOne(d, {
        root,
        skillDir,
        exec,
        execStream: opts.execStream,
        resolveRemote,
        vars,
        journal: res.journal,
      });
      const durationMs = Date.now() - inFlight.at;
      inFlight = null;
      if (opts.onEvent)
        await opts.onEvent({ type: 'step-end', kind: d.kind, line: d.line, label, ok: true, durationMs });
      res.applied.push(`${d.kind}: ${st.detail}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Close the step as failed before classifying — keeps step-start/step-end
      // balanced whether the throw becomes a deferred (unresolved input) or a
      // bounce (a real failure, handled below). The failure-path close is
      // best-effort: a consumer that also throws here can't change the outcome —
      // we're already on the failure path.
      if (inFlight && opts.onEvent) {
        const end = {
          kind: d.kind,
          line: d.line,
          label: inFlight.label,
          ok: false,
          durationMs: Date.now() - inFlight.at,
          error: msg,
        };
        try {
          await opts.onEvent({ type: 'step-end', ...end });
        } catch {
          /* already failing — the close is best-effort */
        }
      }
      if (/unresolved \{\{/.test(msg))
        res.deferred.push(msg); // blocked on a prompt input
      else bounce(d, `engine could not apply (${msg}) — an agent applies it from the prose`);
    }
  }
  // Surface the non-secret resolved values for a caller to consume.
  for (const [k, v] of vars) if (!v.secret) res.vars[k] = v.value;
  return res;
}

// Remove is the journal played backwards — no hand-written REMOVE.md.
export async function removeSkill(
  root: string,
  journal: JournalEntry[],
  exec?: (c: string) => void | Promise<void>,
): Promise<void> {
  for (const e of [...journal].reverse()) {
    if (e.op === 'wrote') rmSync(join(root, e.path), { force: true });
    else if (e.op === 'appended') {
      const p = join(root, e.path);
      writeFileSync(
        p,
        read(p)
          .split('\n')
          .filter((l) => l.trim() !== e.line.trim())
          .join('\n'),
      );
    } else if (e.op === 'set-env') {
      const p = join(root, '.env');
      writeFileSync(
        p,
        read(p)
          .split('\n')
          .filter((l) => !l.startsWith(`${e.key}=`))
          .join('\n'),
      );
    } else if (e.op === 'json-merge') {
      const p = join(root, e.path);
      const arr = JSON.parse(read(p) || '[]') as unknown[];
      if (Array.isArray(arr)) {
        writeFileSync(
          p,
          JSON.stringify(
            arr.filter(
              (el) => !(el !== null && typeof el === 'object' && (el as Record<string, unknown>)[e.key] === e.value),
            ),
            null,
            2,
          ) + '\n',
        );
      }
    } else if (e.op === 'ran' && e.undo && exec) {
      await exec(e.undo);
    }
  }
}
