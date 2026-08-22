import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export const migration022: Migration = {
  version: 22,
  name: 'container-config-role-models',
  up(db: Database.Database) {
    db.exec(`
      ALTER TABLE container_configs ADD COLUMN orchestrator_model TEXT;
      ALTER TABLE container_configs ADD COLUMN sender_model TEXT;
    `);
  },
};
