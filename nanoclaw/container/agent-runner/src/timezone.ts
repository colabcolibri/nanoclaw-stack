/**
 * Timezone utilities — mirror of src/timezone.ts (host).
 *
 * The container can't import from src/ (separate tsconfig, different runtime).
 * Kept deliberately byte-aligned with the host module so behaviour is the
 * same on both sides of the session-DB boundary.
 *
 * Effective timezone priority:
 *   1. `container.json` `timezone` (materialized from DB at spawn — canonical)
 *   2. `process.env.TZ` (docker `-e TZ=…` at spawn; sync-turn sets this on host)
 *   3. system default
 *   4. UTC
 */

import fs from 'node:fs';
import path from 'node:path';

import { CONTAINER_AGENT_DIR } from './runtime-paths.js';

/**
 * Check whether a timezone string is a valid IANA identifier
 * that Intl.DateTimeFormat can use.
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Return the given timezone if valid IANA, otherwise fall back to UTC.
 */
export function resolveTimezone(tz: string): string {
  return isValidTimezone(tz) ? tz : 'UTC';
}

/** Candidate paths for the mounted group container.json (host or container). */
export function containerJsonCandidates(cwd?: string): string[] {
  const files: string[] = [];
  if (cwd) files.push(path.join(cwd, 'container.json'));
  // Only trust the canonical container mount when we're inside a running session
  // container (/workspace/inbound.db is always present there, never on the host).
  const inContainer = fs.existsSync('/workspace/inbound.db');
  const mountedConfig = path.join(CONTAINER_AGENT_DIR, 'container.json');
  if (inContainer && fs.existsSync(mountedConfig)) {
    files.push(mountedConfig);
  }
  if (process.env.AGENT_GROUP_DIR?.trim()) {
    files.push(path.join(process.env.AGENT_GROUP_DIR.trim(), 'container.json'));
  }
  return files;
}

/** Read `timezone` from materialized container.json when present and valid. */
export function readTimezoneFromContainerJson(cwd?: string): string | undefined {
  for (const filePath of containerJsonCandidates(cwd)) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { timezone?: unknown };
      if (typeof parsed.timezone === 'string' && isValidTimezone(parsed.timezone)) {
        return parsed.timezone;
      }
    } catch {
      // try next candidate
    }
  }
  return undefined;
}

function resolveFromEnvOrSystem(): string {
  const candidates = [process.env.TZ, Intl.DateTimeFormat().resolvedOptions().timeZone];
  for (const tz of candidates) {
    if (tz && isValidTimezone(tz)) return tz;
  }
  return 'UTC';
}

/**
 * Effective schedule/display timezone for this group.
 * Prefer container.json over process.env.TZ so JSON remains canonical.
 */
export function resolveEffectiveTimezone(cwd?: string): string {
  return readTimezoneFromContainerJson(cwd) ?? resolveFromEnvOrSystem();
}

/** Alias used by formatters and CLIs at call time (not frozen at import). */
export function getTimezone(cwd?: string): string {
  return resolveEffectiveTimezone(cwd);
}

/** Align process.env.TZ with container.json so child processes (ncl) inherit it. */
export function syncProcessTimezone(cwd?: string): string {
  const tz = resolveEffectiveTimezone(cwd);
  process.env.TZ = tz;
  return tz;
}

/** @deprecated Prefer getTimezone() at call sites — frozen at module load. */
export const TIMEZONE = resolveEffectiveTimezone();

/**
 * Convert a UTC ISO timestamp to a localized display string.
 * Uses the Intl API (no external dependencies).
 * Falls back to UTC if the timezone is invalid.
 */
export function formatLocalTime(utcIso: string, timezone: string): string {
  const date = new Date(utcIso);
  return date.toLocaleString('en-US', {
    timeZone: resolveTimezone(timezone),
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Compact sortable local stamp for log lines: "YYYY-MM-DD HH:mm" in `timezone`.
 * (sv-SE is the one locale whose default rendering is this exact shape.)
 */
export function formatLocalStamp(date: Date, timezone: string): string {
  return date.toLocaleString('sv-SE', {
    timeZone: resolveTimezone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** e.g. "GMT+2" or "GMT-3" for the given instant in `tz`. */
export function formatUtcOffsetLabel(date: Date, tz: string): string {
  const resolved = resolveTimezone(tz);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: resolved,
    timeZoneName: 'longOffset',
  }).formatToParts(date);
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? 'UTC';
}

/**
 * Lines injected into supervisor/worker prompts so scheduling uses the right wall clock.
 */
export function formatSchedulingTimezoneRules(tz: string, now = new Date()): string {
  const resolved = resolveTimezone(tz);
  const offset = formatUtcOffsetLabel(now, resolved);
  return [
    `- Schedule timezone (ncl tasks cron & naive --process-after): ${resolved} (${offset} now)`,
    `- UTC now: ${now.toISOString()}`,
    '- Times the user gives without a timezone → interpret in the schedule timezone above.',
    '- If the user names another timezone (e.g. Brasília, BRT, horário do Brasil):',
    '  - One-shot: pass ISO with offset in --process-after (e.g. 2026-08-24T06:00:00-03:00).',
    `  - Cron: convert each hour to ${resolved} before writing the 5-field expression; confirm the translated schedule back to the user.`,
    '- If they always speak in a different zone, suggest `ncl groups config update --timezone <IANA>` so naive times match their wall clock.',
  ].join('\n');
}

/**
 * Interpret a naive ISO-like timestamp (no trailing `Z`, no offset) as wall-clock
 * time in `tz` and return the corresponding UTC Date. Strings that already carry
 * offset info (`Z` or `±HH:MM`) are passed through to the Date constructor
 * unchanged.
 *
 * Algorithm: treat the naive string as UTC, ask Intl.DateTimeFormat what that
 * UTC instant is called in `tz`, then invert the offset. Near DST boundaries
 * this can be off by an hour for ~1h of wall-clock time per year; acceptable
 * for scheduling where the agent normally picks round-hour targets.
 */
export function parseZonedToUtc(input: string, tz: string): Date {
  const hasOffset = /Z$|[+-]\d{2}:?\d{2}$/.test(input.trim());
  if (hasOffset) return new Date(input);

  const zone = resolveTimezone(tz);
  const asIfUtc = new Date(input + 'Z');
  if (Number.isNaN(asIfUtc.getTime())) return asIfUtc;

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt
      .formatToParts(asIfUtc)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  );
  const hour = parts.hour === '24' ? '00' : parts.hour;
  const zonedAsUtcMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMs = zonedAsUtcMs - asIfUtc.getTime();
  return new Date(asIfUtc.getTime() - offsetMs);
}
