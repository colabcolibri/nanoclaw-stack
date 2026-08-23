import type { SqliteDatabase } from '../sqlite-compat.js';
import type { Migration } from './index.js';

export const migration015: Migration = {
  version: 15,
  name: 'cli-scope',
  up(db: SqliteDatabase) {
    db.prepare("ALTER TABLE container_configs ADD COLUMN cli_scope TEXT NOT NULL DEFAULT 'group'").run();
  },
};
