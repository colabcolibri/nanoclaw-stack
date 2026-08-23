import type { SqliteDatabase } from '../sqlite-compat.js';
import type { Migration } from './index.js';

export const migration022: Migration = {
  version: 22,
  name: 'container-config-role-models',
  up(db: SqliteDatabase) {
    db.exec(`
      ALTER TABLE container_configs ADD COLUMN orchestrator_model TEXT;
      ALTER TABLE container_configs ADD COLUMN sender_model TEXT;
    `);
  },
};
