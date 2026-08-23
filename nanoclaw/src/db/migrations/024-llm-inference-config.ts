import type { SqliteDatabase } from '../sqlite-compat.js';
import type { Migration } from './index.js';

export const migration024: Migration = {
  version: 24,
  name: 'llm-inference-config',
  up(db: SqliteDatabase) {
    db.exec(`
      ALTER TABLE llm_providers ADD COLUMN protocol TEXT NOT NULL DEFAULT 'openai-compatible';
      ALTER TABLE llm_providers ADD COLUMN api_key_ciphertext TEXT;
      ALTER TABLE llm_providers ADD COLUMN default_params TEXT;
      ALTER TABLE llm_models ADD COLUMN inference_params TEXT;
    `);

    db.prepare(`UPDATE llm_providers SET protocol = 'anthropic' WHERE id = 'claude'`).run();
  },
};
