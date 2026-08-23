import type { SqliteDatabase } from '../sqlite-compat.js';
import type { Migration } from './index.js';

export const migration026: Migration = {
  version: 26,
  name: 'container-config-memo-and-inference',
  up(db: SqliteDatabase) {
    db.exec(`
      ALTER TABLE container_configs ADD COLUMN memo_model TEXT;
      ALTER TABLE container_configs ADD COLUMN role_inference_params TEXT;
    `);
  },
};
