import { parseDirectives, promptVar, type Directive } from '../skill-directives.js';
import { destOf, envKeySet, fileHasLine, has, jsonArrayHasKey, pkgHasDep, read, VAR_REF } from './shared.js';
import type { PlanStep, StepStatus } from './types.js';
import { join } from 'node:path';

// Per-directive idempotency check + "what it would do". Read-only.
export function selfStatus(d: Directive, root: string): { status: StepStatus; detail: string } {
  switch (d.kind) {
    case 'copy': {
      const dests = d.body.map(destOf);
      const missing = dests.filter((p) => !has(root, p));
      const from = d.attrs['from-branch'] ? `fetch ${String(d.attrs['from-branch'])} → ` : '';
      return missing.length
        ? { status: 'apply', detail: `${from}copy ${missing.join(', ')} (absent)` }
        : { status: 'skip', detail: `${dests.join(', ')} present` };
    }
    case 'append': {
      const to = String(d.attrs.to ?? '');
      const line = d.body[0] ?? '';
      return fileHasLine(root, to, line)
        ? { status: 'skip', detail: `${to} already has the line` }
        : { status: 'apply', detail: `add to ${to}: ${line}` };
    }
    case 'dep': {
      const missing = d.body.filter((s) => !pkgHasDep(root, s.slice(0, s.lastIndexOf('@'))));
      return missing.length
        ? { status: 'apply', detail: `install ${missing.join(', ')}` }
        : { status: 'skip', detail: `${d.body.join(', ')} present` };
    }
    case 'run':
      return { status: 'apply', detail: `${String(d.attrs.effect ?? 'run')}: ${d.body.join(' && ')}` };
    case 'env-set': {
      const keys = d.body.map((l) => l.split('=')[0].trim());
      const missing = keys.filter((k) => !envKeySet(root, k));
      return missing.length
        ? { status: 'apply', detail: `set ${missing.join(', ')} in .env` }
        : { status: 'skip', detail: `${keys.join(', ')} already set` };
    }
    case 'json-merge': {
      const into = String(d.attrs.into ?? '');
      const key = String(d.attrs.key ?? '');
      let value: unknown;
      try {
        value = (JSON.parse(d.body.join('\n')) as Record<string, unknown>)[key];
      } catch {
        return {
          status: 'agent',
          detail: `nc:json-merge body is not parseable JSON — an agent applies it from the prose`,
        };
      }
      return jsonArrayHasKey(root, into, key, value)
        ? { status: 'skip', detail: `${into} already has ${key}=${JSON.stringify(value)}` }
        : { status: 'apply', detail: `merge ${key}=${JSON.stringify(value)} into ${into}` };
    }
    case 'prompt':
      return { status: 'needs-input', detail: '' };
    case 'operator':
      return { status: 'apply', detail: `show operator: ${(d.body[0] ?? '').slice(0, 50)}…` };
    default:
      return {
        status: 'agent',
        detail: `no deterministic handler for nc:${d.kind} — an agent applies it from the prose`,
      };
  }
}

export function planSkill(
  skillDir: string,
  root: string,
): { steps: PlanStep[]; needsInput: string[]; agentSteps: number } {
  const directives = parseDirectives(read(join(skillDir, 'SKILL.md')));
  const self = directives.map((d) => ({ d, ...selfStatus(d, root) }));

  const consumers = new Map<string, number[]>();
  self.forEach(({ d }, i) => {
    for (const line of d.body)
      for (const m of line.matchAll(VAR_REF)) (consumers.get(m[1]) ?? consumers.set(m[1], []).get(m[1])!).push(i);
  });

  const steps: PlanStep[] = self.map(({ d, status, detail }, i) => {
    if (d.kind !== 'prompt') return { n: i + 1, kind: d.kind, line: d.line, status, detail };
    const v = promptVar(d) ?? '?';
    const tag = `${v}${d.args.includes('secret') ? ' (secret)' : ''}`;
    const cons = consumers.get(v) ?? [];
    const satisfied = cons.length > 0 && cons.every((j) => self[j].status === 'skip');
    return satisfied
      ? { n: i + 1, kind: d.kind, line: d.line, status: 'skip', detail: `${tag} — consumers already satisfied` }
      : { n: i + 1, kind: d.kind, line: d.line, status: 'needs-input', detail: `${tag} → asked during apply` };
  });

  return {
    steps,
    needsInput: steps.filter((s) => s.status === 'needs-input').map((s) => s.detail.split(' ')[0]),
    agentSteps: steps.filter((s) => s.status === 'agent').length,
  };
}
