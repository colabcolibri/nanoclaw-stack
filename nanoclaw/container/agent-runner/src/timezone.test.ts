import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'bun:test';

import {
  formatLocalTime,
  formatSchedulingTimezoneRules,
  formatUtcOffsetLabel,
  getTimezone,
  isValidTimezone,
  parseZonedToUtc,
  readTimezoneFromContainerJson,
  resolveEffectiveTimezone,
  resolveTimezone,
  syncProcessTimezone,
} from './timezone.js';

// --- formatLocalTime ---

describe('formatLocalTime', () => {
  it('converts UTC to local time display', () => {
    // 2026-02-04T18:30:00Z in America/New_York (EST, UTC-5) = 1:30 PM
    const result = formatLocalTime('2026-02-04T18:30:00.000Z', 'America/New_York');
    expect(result).toContain('1:30');
    expect(result).toContain('PM');
    expect(result).toContain('Feb');
    expect(result).toContain('2026');
  });

  it('handles different timezones', () => {
    // Same UTC time should produce different local times
    const utc = '2026-06-15T12:00:00.000Z';
    const ny = formatLocalTime(utc, 'America/New_York');
    const tokyo = formatLocalTime(utc, 'Asia/Tokyo');
    // NY is UTC-4 in summer (EDT), Tokyo is UTC+9
    expect(ny).toContain('8:00');
    expect(tokyo).toContain('9:00');
  });

  it('does not throw on invalid timezone, falls back to UTC', () => {
    expect(() => formatLocalTime('2026-01-01T00:00:00.000Z', 'IST-2')).not.toThrow();
    const result = formatLocalTime('2026-01-01T12:00:00.000Z', 'IST-2');
    // Should format as UTC (noon UTC = 12:00 PM)
    expect(result).toContain('12:00');
    expect(result).toContain('PM');
  });
});

describe('isValidTimezone', () => {
  it('accepts valid IANA identifiers', () => {
    expect(isValidTimezone('America/New_York')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
    expect(isValidTimezone('Asia/Tokyo')).toBe(true);
    expect(isValidTimezone('Asia/Jerusalem')).toBe(true);
  });

  it('rejects invalid timezone strings', () => {
    expect(isValidTimezone('IST-2')).toBe(false);
    expect(isValidTimezone('XYZ+3')).toBe(false);
  });

  it('rejects empty and garbage strings', () => {
    expect(isValidTimezone('')).toBe(false);
    expect(isValidTimezone('NotATimezone')).toBe(false);
  });
});

describe('resolveTimezone', () => {
  it('returns the timezone if valid', () => {
    expect(resolveTimezone('America/New_York')).toBe('America/New_York');
  });

  it('falls back to UTC for invalid timezone', () => {
    expect(resolveTimezone('IST-2')).toBe('UTC');
    expect(resolveTimezone('')).toBe('UTC');
  });
});

describe('parseZonedToUtc', () => {
  it('passes strings with Z suffix through unchanged', () => {
    const d = parseZonedToUtc('2026-01-15T09:00:00Z', 'America/New_York');
    expect(d.toISOString()).toBe('2026-01-15T09:00:00.000Z');
  });

  it('passes strings with numeric offset through unchanged', () => {
    const d = parseZonedToUtc('2026-01-15T09:00:00+02:00', 'America/New_York');
    expect(d.toISOString()).toBe('2026-01-15T07:00:00.000Z');
  });

  it('interprets naive ISO as wall-clock in the given timezone', () => {
    // 09:00 naive in NY in January = 09:00 EST = 14:00 UTC
    const d = parseZonedToUtc('2026-01-15T09:00:00', 'America/New_York');
    expect(d.toISOString()).toBe('2026-01-15T14:00:00.000Z');
  });

  it('handles a different positive-offset zone', () => {
    // 09:00 naive in Tokyo (UTC+9) = 00:00 UTC
    const d = parseZonedToUtc('2026-06-15T09:00:00', 'Asia/Tokyo');
    expect(d.toISOString()).toBe('2026-06-15T00:00:00.000Z');
  });

  it('treats invalid timezone as UTC', () => {
    const d = parseZonedToUtc('2026-01-15T09:00:00', 'NotATimezone');
    expect(d.toISOString()).toBe('2026-01-15T09:00:00.000Z');
  });
});

describe('formatUtcOffsetLabel', () => {
  it('returns a GMT offset for a known zone', () => {
    const label = formatUtcOffsetLabel(new Date('2026-06-15T12:00:00.000Z'), 'America/Sao_Paulo');
    expect(label).toMatch(/GMT[+-]\d/);
  });
});

describe('formatSchedulingTimezoneRules', () => {
  it('includes schedule timezone and conversion rules', () => {
    const now = new Date('2026-08-24T12:00:00.000Z');
    const rules = formatSchedulingTimezoneRules('America/Sao_Paulo', now);
    expect(rules).toContain('Schedule timezone (ncl tasks');
    expect(rules).toContain('America/Sao_Paulo');
    expect(rules).toContain('2026-08-24T12:00:00.000Z');
    expect(rules).toContain('Brasília');
    expect(rules).toContain('--process-after');
  });
});

describe('resolveEffectiveTimezone', () => {
  it('prefers container.json over process.env.TZ', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-tz-'));
    try {
      fs.writeFileSync(
        path.join(tmp, 'container.json'),
        JSON.stringify({ timezone: 'Europe/Brussels' }),
      );
      const prev = process.env.TZ;
      process.env.TZ = 'UTC';
      expect(readTimezoneFromContainerJson(tmp)).toBe('Europe/Brussels');
      expect(resolveEffectiveTimezone(tmp)).toBe('Europe/Brussels');
      expect(getTimezone(tmp)).toBe('Europe/Brussels');
      process.env.TZ = prev;
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('syncProcessTimezone aligns env with container.json', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-tz-sync-'));
    try {
      fs.writeFileSync(
        path.join(tmp, 'container.json'),
        JSON.stringify({ timezone: 'America/Sao_Paulo' }),
      );
      process.env.TZ = 'UTC';
      expect(syncProcessTimezone(tmp)).toBe('America/Sao_Paulo');
      expect(process.env.TZ).toBe('America/Sao_Paulo');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
