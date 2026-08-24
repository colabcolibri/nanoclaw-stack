import fs from 'node:fs';
import path from 'node:path';

import { CONTAINER_AGENT_DIR } from './runtime-paths.js';

export interface ContainerLocation {
  city: string;
  country: string;
  location: string;
}

/** Normalize city/country/location fields from container.json shapes. */
export function parseLocationFields(input: {
  city?: string | null;
  country?: string | null;
  location?: string | null;
}): ContainerLocation {
  let city = (input.city ?? '').trim();
  let country = (input.country ?? '').trim();
  const rawLocation = (input.location ?? '').trim();

  if (!city && !country && rawLocation) {
    const parts = rawLocation.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      city = parts[0];
      country = parts.slice(1).join(', ');
    } else if (parts.length === 1) {
      city = parts[0];
    }
  }

  const location = rawLocation || [city, country].filter(Boolean).join(', ');
  return { city, country, location };
}

/** Read geographic context from the mounted group container.json. */
export function readContainerLocation(cwd?: string): ContainerLocation {
  const candidateFiles: string[] = [];
  if (cwd) candidateFiles.push(path.join(cwd, 'container.json'));
  candidateFiles.push(path.join(CONTAINER_AGENT_DIR, 'container.json'));
  if (process.env.AGENT_GROUP_DIR?.trim()) {
    candidateFiles.push(path.join(process.env.AGENT_GROUP_DIR.trim(), 'container.json'));
  }

  for (const filePath of candidateFiles) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
      return parseLocationFields({
        city: typeof parsed.city === 'string' ? parsed.city : null,
        country: typeof parsed.country === 'string' ? parsed.country : null,
        location: typeof parsed.location === 'string' ? parsed.location : null,
      });
    } catch {
      // try next candidate
    }
  }

  return { city: '', country: '', location: '' };
}

export function formatContextHeader(
  timezone: string,
  location: ContainerLocation = readContainerLocation(),
): string {
  const attrs = [`timezone="${escapeXml(timezone)}"`];
  if (location.city) attrs.push(`city="${escapeXml(location.city)}"`);
  if (location.country) attrs.push(`country="${escapeXml(location.country)}"`);
  return `<context ${attrs.join(' ')} />`;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
