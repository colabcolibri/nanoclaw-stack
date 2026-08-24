import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { formatContextHeader, parseLocationFields, readContainerLocation } from '../src/container-location.js';

describe('parseLocationFields', () => {
  it('combines city and country into location', () => {
    expect(parseLocationFields({ city: 'Tielen', country: 'Belgica' })).toEqual({
      city: 'Tielen',
      country: 'Belgica',
      location: 'Tielen, Belgica',
    });
  });

  it('splits legacy location strings into city and country', () => {
    expect(parseLocationFields({ location: 'Tielen, Belgica' })).toEqual({
      city: 'Tielen',
      country: 'Belgica',
      location: 'Tielen, Belgica',
    });
  });
});

describe('formatContextHeader', () => {
  it('includes city and country attributes when present', () => {
    expect(
      formatContextHeader('Europe/Brussels', {
        city: 'Tielen',
        country: 'Belgica',
        location: 'Tielen, Belgica',
      }),
    ).toBe('<context timezone="Europe/Brussels" city="Tielen" country="Belgica" />');
  });

  it('keeps timezone-only header when location is empty', () => {
    expect(formatContextHeader('UTC', { city: '', country: '', location: '' })).toBe(
      '<context timezone="UTC" />',
    );
  });
});

describe('readContainerLocation', () => {
  let tmp = '';
  let previousAgentGroupDir = process.env.AGENT_GROUP_DIR;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'container-location-'));
    previousAgentGroupDir = process.env.AGENT_GROUP_DIR;
    process.env.AGENT_GROUP_DIR = tmp;
  });

  afterEach(() => {
    if (previousAgentGroupDir === undefined) delete process.env.AGENT_GROUP_DIR;
    else process.env.AGENT_GROUP_DIR = previousAgentGroupDir;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('reads city and country from the group container.json', () => {
    fs.writeFileSync(
      path.join(tmp, 'container.json'),
      JSON.stringify({ city: 'Tielen', country: 'Belgica', timezone: 'Europe/Brussels' }),
      'utf-8',
    );

    expect(readContainerLocation()).toEqual({
      city: 'Tielen',
      country: 'Belgica',
      location: 'Tielen, Belgica',
    });
  });
});
