import type { SqliteDatabase } from '../sqlite-compat.js';
import type { Migration } from './index.js';

/**
 * Per-agent-group geographic context on `container_configs`.
 *
 * NULL = unset. Values are materialized into `container.json` at spawn time
 * and injected into every agent turn via the `<context …/>` header and the
 * multi-agent temporal context block.
 *
 * Columns may already exist on installs that saved location via the UI before
 * this migration shipped — addIfMissing keeps those installs safe.
 */
export const migration027: Migration = {
  version: 27,
  name: 'container-config-location',
  up(db: SqliteDatabase) {
    const addIfMissing = (sql: string): void => {
      try {
        db.exec(sql);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('duplicate column') || msg.includes('already exists')) return;
        throw err;
      }
    };

    addIfMissing(`ALTER TABLE container_configs ADD COLUMN city TEXT;`);
    addIfMissing(`ALTER TABLE container_configs ADD COLUMN country TEXT;`);
    addIfMissing(`ALTER TABLE container_configs ADD COLUMN location TEXT;`);
  },
};
