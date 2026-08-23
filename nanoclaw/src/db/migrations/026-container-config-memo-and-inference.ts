import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export const migration026: Migration = {
  version: 26,
  name: 'container-config-memo-and-inference',
  up(db: Database.Database) {
    db.exec(`
      ALTER TABLE container_configs ADD COLUMN memo_model TEXT;
      ALTER TABLE container_configs ADD COLUMN role_inference_params TEXT;
    `);
  },
};
