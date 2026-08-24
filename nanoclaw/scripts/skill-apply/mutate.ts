import { appendFileSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Directive } from '../skill-directives.js';
import { destOf, envKeySet, read, srcOf } from './shared.js';
import { bindCapture, substitute } from './vars.js';
import type { JournalEntry, StepOutcome } from './types.js';

// The mutating twin of selfStatus. Records what it did to the journal so remove
// is derivable. Throws on failure → caught and bounced to an agent.
export async function applyOne(
  d: Directive,
  ctx: {
    root: string;
    skillDir: string;
    exec: (c: string) => string | void | Promise<string | void>;
    execStream?: (c: string) => Promise<StepOutcome>;
    resolveRemote: (b: string) => string;
    vars: Map<string, { value: string; secret: boolean }>;
    journal: JournalEntry[];
  },
): Promise<void> {
  const { root, skillDir, exec, vars, journal } = ctx;
  switch (d.kind) {
    case 'copy':
      if (d.attrs['from-branch']) {
        const b = String(d.attrs['from-branch']);
        const remote = ctx.resolveRemote(b);
        await exec(`git fetch ${remote} ${b}`);
        for (const l of d.body) {
          // The shell redirect can't create parent directories, and the dest
          // may not exist on trunk (e.g. container skills that live only on
          // the channels branch). Mirror the local-copy path's mkdir.
          mkdirSync(dirname(join(root, destOf(l))), { recursive: true });
          await exec(`git show ${remote}/${b}:${srcOf(l)} > ${destOf(l)}`);
        }
      } else {
        for (const l of d.body) {
          const dst = join(root, destOf(l));
          mkdirSync(dirname(dst), { recursive: true });
          copyFileSync(join(skillDir, srcOf(l)), dst);
        }
      }
      for (const l of d.body) journal.push({ op: 'wrote', path: destOf(l) });
      break;
    case 'append': {
      const to = String(d.attrs.to);
      const marker = typeof d.attrs.at === 'string' ? d.attrs.at : undefined;
      const target = join(root, to);
      if (marker) {
        // Insert before the `// <<< <marker>` closing line of a dormant marker
        // region, matching that line's indentation. removeSkill still deletes
        // by line (position-agnostic), so the journal entry is unchanged.
        const close = `<<< ${marker}`;
        for (const line of d.body) {
          const lines = read(target).split('\n');
          const idx = lines.findIndex((l) => l.includes(close));
          if (idx === -1) throw new Error(`append marker "${marker}" not found in ${to}`);
          const indent = lines[idx].match(/^\s*/)?.[0] ?? '';
          lines.splice(idx, 0, indent + line);
          writeFileSync(target, lines.join('\n'));
          journal.push({ op: 'appended', path: to, line });
        }
      } else {
        for (const line of d.body) {
          appendFileSync(target, (read(target).endsWith('\n') || read(target) === '' ? '' : '\n') + line + '\n');
          journal.push({ op: 'appended', path: to, line });
        }
      }
      break;
    }
    case 'dep': {
      await exec(`pnpm add ${d.body.join(' ')}`);
      const names = d.body.map((s) => s.slice(0, s.lastIndexOf('@'))).join(' ');
      journal.push({ op: 'ran', cmd: `pnpm add ${d.body.join(' ')}`, undo: `pnpm remove ${names}` });
      break;
    }
    case 'run': {
      // `capture:<var>` binds the command's stdout into a {{var}} — the twin of
      // `prompt` (which binds human input). Lets a run resolve a value from an
      // API (e.g. Slack conversations.open → the DM channel id) and feed it to a
      // later directive, so a flow that validates/resolves stays pure directives.
      const capture = typeof d.attrs.capture === 'string' ? d.attrs.capture : undefined;
      // A `validate:<re>` shape-guard the stdout capture enforces (see bindCapture).
      const validate = typeof d.attrs.validate === 'string' ? d.attrs.validate : undefined;
      // effect:check runs the body as a shell PREDICATE — a precondition gate
      // that mutates NOTHING. It pushes no journal entry and binds no capture: a
      // zero exit is a silent pass; a non-zero exit throws → the outer catch
      // bounces it to an agent (which reads the prose and decides); an unresolved
      // {{var}} throws from substitute first → deferred (like any other run, e.g.
      // a headless rebuild before the value is collected). Because a bounce here
      // latches `blocked`, a failed precondition gates the dangerous side effects
      // (a restart, a pairing/QR step, a wire) that follow — a broken local
      // config or an un-registered app never reaches a doomed restart/QR.
      if (d.attrs.effect === 'check') {
        for (const cmd of d.body) await exec(substitute(cmd, vars));
        break;
      }
      // effect:step runs a long-running, operator-interactive step (a pairing
      // code, a QR device-link) through the streaming exec and binds the terminal
      // status block's named fields via capture:<var>=<FIELD>[,…] — the structured,
      // multi-valued twin of stdout capture. No streaming exec ⇒ throw → an agent
      // runs the step from the prose (degrade, not crash).
      if (d.attrs.effect === 'step') {
        if (!ctx.execStream)
          throw new Error('effect:step needs a streaming exec — an agent runs the step from the prose');
        const { ok, fields } = await ctx.execStream(substitute(d.body.join('\n'), vars));
        if (!ok) throw new Error('the step did not complete');
        if (capture) {
          for (const pair of capture.split(',')) {
            const eq = pair.indexOf('=');
            if (eq < 1) continue;
            vars.set(pair.slice(0, eq).trim(), {
              value: (fields[pair.slice(eq + 1).trim()] ?? '').trim(),
              secret: false,
            });
          }
        }
        journal.push({ op: 'ran', cmd: d.body.join('\n') });
        break;
      }
      for (const cmd of d.body) {
        // Interpolate prompted {{vars}} the same way env-set does, so a run can
        // call `ncl ... {{owner_email}}` to wire from collected input. A command
        // with no {{...}} (build/test) is returned unchanged; an unresolved var
        // throws → caught → deferred (the prompt hasn't been answered yet).
        const out = await exec(substitute(cmd, vars));
        // Last command wins for capture (a capture run should be a single command).
        // bindCapture binds stdout-as-is OR a multi-field JSON spec, and enforces
        // validate:<re> — a mismatch / unparseable JSON throws → bounced to an agent.
        if (capture) bindCapture(capture, typeof out === 'string' ? out.trim() : '', validate, vars);
        // Journal the ORIGINAL command (placeholders intact) — never the
        // substituted form — so a secret interpolated into a run never lands in
        // the journal (or a remove replay).
        const undo = d.attrs.effect === 'external' && typeof d.attrs.remove === 'string' ? d.attrs.remove : undefined;
        journal.push({ op: 'ran', cmd, undo });
      }
      break;
    }
    case 'env-set': {
      const envPath = join(root, '.env');
      for (const entry of d.body) {
        const eq = entry.indexOf('=');
        const key = entry.slice(0, eq).trim();
        const value = substitute(entry.slice(eq + 1).trim(), vars); // throws if a {{var}} is unresolved
        if (!envKeySet(root, key)) {
          appendFileSync(
            envPath,
            (read(envPath).endsWith('\n') || read(envPath) === '' ? '' : '\n') + `${key}=${value}\n`,
          );
          journal.push({ op: 'set-env', key });
        }
      }
      break;
    }
    case 'json-merge': {
      const into = String(d.attrs.into);
      const key = String(d.attrs.key);
      const obj = JSON.parse(d.body.join('\n')) as Record<string, unknown>;
      const target = join(root, into);
      const arr = JSON.parse(read(target) || '[]') as unknown[];
      if (!Array.isArray(arr)) throw new Error(`${into} is not a JSON array`);
      const value = obj[key];
      // Idempotent: only push when no element already matches on the key.
      if (!arr.some((el) => el !== null && typeof el === 'object' && (el as Record<string, unknown>)[key] === value)) {
        arr.push(obj);
        writeFileSync(target, JSON.stringify(arr, null, 2) + '\n');
        journal.push({ op: 'json-merge', path: into, key, value });
      }
      break;
    }
    default:
      throw new Error(`no handler for nc:${d.kind}`);
  }
}
