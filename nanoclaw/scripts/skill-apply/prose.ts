// Prose around the directives: the reference-floor slicer, the agent-facing
// prose extraction, and heading-derived step labels.

import type { Directive } from '../skill-directives.js';

// The author-written REFERENCE sections the apply engine ignores entirely:
// `## Alternatives`, `## Optional configuration`, `## Troubleshooting`. Matched
// on the heading text (lowercased), level-2 only.
const REFERENCE_HEADINGS = new Set(['alternatives', 'optional configuration', 'troubleshooting']);

/**
 * Slice a skill's reference floor out of its raw markdown — the
 * `## Alternatives` / `## Optional configuration` / `## Troubleshooting` sections
 * the engine never executes. This is the human floor a reader scrolls to (a
 * dedicated-number path, optional env knobs, dropped-symptom fixes); the driver
 * surfaces it beside the bounced agentTasks so the operator has the same
 * reference. Returned VERBATIM from the author text keyed on the headings — never
 * from the resolved {{var}} map — so a resolved {{secret}} can never leak into it
 * (a `{{token}}` placeholder, if a reference section ever wrote one, stays a
 * literal placeholder). Any stray `nc:` directive fence inside a section is
 * dropped: reference prose is plain bash/json/text only — an `nc:` block belongs
 * under Apply, never here. Fence state is tracked so a `# comment` line inside a
 * code block is never mistaken for a markdown heading that would end the slice.
 */
export function referenceProse(md: string): string {
  const sections: string[] = [];
  let cur: string[] | null = null; // lines of the section being collected, or null
  let fence: string | null = null; // open fence's info-string ('' for a bare fence), or null
  const keep = (line: string): void => {
    // Inside (or toggling) an `nc:` fence ⇒ drop; otherwise collect when capturing.
    if (cur && !(fence ?? '').startsWith('nc:')) cur.push(line);
  };
  for (const line of md.split('\n')) {
    if (line.startsWith('```')) {
      if (fence === null) {
        fence = line.slice(3).trim();
        keep(line);
      } else {
        keep(line); // closing fence — `fence` still holds the opening info-string
        fence = null;
      }
      continue;
    }
    if (fence !== null) {
      keep(line);
      continue;
    } // fence body
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim().toLowerCase();
      if (level === 2 && REFERENCE_HEADINGS.has(text)) {
        if (cur) sections.push(cur.join('\n').trim());
        cur = [line]; // open a new reference section
      } else if (level <= 2) {
        if (cur) {
          sections.push(cur.join('\n').trim());
          cur = null;
        } // a non-reference h1/h2 closes the slice
      } else if (cur) {
        cur.push(line); // a subsection (### …) inside a captured reference section
      }
      continue;
    }
    if (cur) cur.push(line);
  }
  if (cur) sections.push(cur.join('\n').trim());
  return sections.filter(Boolean).join('\n\n').trim();
}

// The prose an agent reads when a step degrades: nearest heading + the
// paragraph immediately above the directive fence.
export function proseFor(md: string, fenceLine1: number): string {
  const lines = md.split('\n');
  let i = fenceLine1 - 2;
  while (i >= 0 && lines[i].trim() === '') i--;
  const para: string[] = [];
  while (i >= 0 && lines[i].trim() !== '' && !lines[i].startsWith('#')) para.unshift(lines[i--]);
  let heading = '';
  for (let h = i; h >= 0; h--)
    if (lines[h].startsWith('#')) {
      heading = lines[h];
      break;
    }
  return [heading, ...para].filter(Boolean).join('\n').trim();
}

// The nearest `#`-prefixed heading above a fence (the same upward scan proseFor
// uses), stripped of its leading `#`s — a concise caption for a step spinner.
export function headingAbove(md: string, fenceLine1: number): string {
  const lines = md.split('\n');
  for (let h = fenceLine1 - 2; h >= 0; h--) {
    if (lines[h].startsWith('#')) {
      // Drop a leading authoring ordinal ("### 2. Copy the adapter" → "Copy the
      // adapter"). Those numbers index the SKILL.md for a READER; as step
      // captions they are actively wrong. A skipped step leaves a hole (1, 3,
      // 4…), a heading with several directives repeats its number, headings
      // without one render bare, and a flow that applies several skills in
      // sequence restarts the count mid-run — so the operator sees
      // "1, 3, 4, 4, Restart, 2, 4". The engine's own (i/n) suffix
      // (labelOrdinals) already disambiguates repeats, and it stays correct.
      return lines[h]
        .replace(/^#+\s*/, '')
        .replace(/^\d+[.)]\s+/, '')
        .trim();
    }
  }
  return '';
}

// The run effects worth a spinner — the slow, operator-waits-on-it ones.
// `effect:step` is deliberately absent: it renders its own live operator output
// (a QR card, a pairing code) that a concurrent spinner would clobber, so it
// stays unlabelled (null) like the instant kinds.
const SPIN_EFFECTS = new Set(['build', 'test', 'fetch', 'wire', 'restart', 'external']);

/**
 * The human caption a consumer may show for a step. `null` is a DECLARATION,
 * not render advice: the step is instant/cheap (a local file copy, an env
 * write, a json-merge), or it renders its own live operator-facing output
 * (`effect:step`'s QR card / pairing code) — the step event still carries
 * `kind` + `line`, so a consumer wanting a different render policy can derive
 * its own. Labels are HEADING-DERIVED only: the caption is the nearest heading
 * above the directive (so a consumer's progress line reads like the section
 * it's in), falling back to a kind/effect default.
 */
export function stepLabel(d: Directive, md: string): string | null {
  const effect = typeof d.attrs.effect === 'string' ? d.attrs.effect : undefined;
  const spins =
    d.kind === 'dep' ||
    (d.kind === 'copy' && typeof d.attrs['from-branch'] === 'string') ||
    (d.kind === 'run' && (effect === undefined || SPIN_EFFECTS.has(effect)));
  if (!spins) return null;
  const heading = headingAbove(md, d.line);
  if (heading) return heading;
  if (d.kind === 'dep') return 'Installing dependencies';
  if (d.kind === 'copy') return 'Fetching files';
  const byEffect: Record<string, string> = {
    build: 'Building',
    test: 'Testing',
    fetch: 'Fetching',
    wire: 'Wiring',
    restart: 'Restarting',
    external: 'Running',
  };
  return (effect && byEffect[effect]) || 'Running';
}
