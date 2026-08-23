import path from 'path';

import { DATA_DIR } from '../config.js';
import { getDb, initDb } from './connection.js';
import { runMigrations } from './migrations/index.js';

/**
 * Idempotent central DB bootstrap for entry points outside main() (e.g. Mac sync-turn subprocess).
 * No-op when the host already called initDb() (Telegram, router, delivery).
 */
export function ensureCentralDb(): ReturnType<typeof getDb> {
  try {
    return getDb();
  } catch {
    const dbPath = path.join(DATA_DIR, 'v2.db');
    const db = initDb(dbPath);
    runMigrations(db);
    return db;
  }
}
