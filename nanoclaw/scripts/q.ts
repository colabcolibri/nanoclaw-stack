/**
 * scripts/q.ts — sqlite3 CLI replacement for skill SQL invocations.
 *
 * Usage:
 *   pnpm exec tsx scripts/q.ts <db-path> "<sql>"
 *
 * Uses the statement reader flag to distinguish queries (SELECT / WITH...SELECT)
 * from mutations. Queries print rows in sqlite3 CLI default ("list") format —
 * pipe-separated, no header — so existing skill text reads identically. Mutations
 * run via stmt.run() (single statement) or db.exec() (compound).
 */
import { openSqliteDatabase } from '../src/db/sqlite-compat.js';

const [, , dbPath, sql] = process.argv;

if (!dbPath || sql === undefined) {
  console.error('Usage: pnpm exec tsx scripts/q.ts <db-path> "<sql>"');
  process.exit(2);
}

const db = openSqliteDatabase(dbPath);
try {
  const trimmed = sql.trim();
  if (/;\s*\S/.test(trimmed)) {
    db.exec(trimmed);
  } else {
    const stmt = db.prepare(trimmed);
    if (stmt.reader) {
      const rows = stmt.all() as Record<string, unknown>[];
      for (const row of rows) {
        console.log(
          Object.values(row)
            .map((v) => (v === null ? '' : String(v)))
            .join('|'),
        );
      }
    } else {
      stmt.run();
    }
  }
} finally {
  db.close();
}
