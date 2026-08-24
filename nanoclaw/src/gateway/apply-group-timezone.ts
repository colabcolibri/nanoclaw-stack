import fs from 'fs';
import path from 'path';

import { isValidTimezone } from '../timezone.js';

/**
 * Align process.env.TZ with the materialized group container.json before
 * loading agent-runner modules (sync-turn subprocess runs on the host).
 */
export function applyGroupTimezoneFromDir(groupDir: string): string {
  const filePath = path.join(groupDir, 'container.json');
  let tz: string | undefined;
  try {
    if (fs.existsSync(filePath)) {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { timezone?: unknown };
      if (typeof raw.timezone === 'string' && isValidTimezone(raw.timezone)) {
        tz = raw.timezone;
      }
    }
  } catch {
    /* fall through */
  }

  if (!tz) {
    const envTz = process.env.TZ?.trim();
    if (envTz && isValidTimezone(envTz)) tz = envTz;
  }

  if (!tz) tz = 'UTC';
  process.env.TZ = tz;
  return tz;
}
