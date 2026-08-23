import { describe, expect, it } from 'vitest';

import { closeDb, getDb, initTestDb } from './connection.js';
import { ensureCentralDb } from './ensure-central-db.js';
import { runMigrations } from './migrations/index.js';

describe('ensureCentralDb', () => {
  it('returns existing db without reinitializing', () => {
    const db = initTestDb();
    runMigrations(db);
    expect(ensureCentralDb()).toBe(getDb());
    closeDb();
  });
});
