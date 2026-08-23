/**
 * Fallback SQLite driver when better-sqlite3 native bindings are unavailable
 * (e.g. Node ABI mismatch during local dev). Uses Node's built-in node:sqlite.
 */
import { DatabaseSync } from 'node:sqlite';

export type OpenSqliteOptions = { readonly?: boolean };
export type SqliteDatabase = SqliteCompatDatabase | import('better-sqlite3').Database;

type Stmt = ReturnType<DatabaseSync['prepare']>;

class SqliteCompatStatement {
  readonly reader: boolean;

  constructor(private readonly stmt: Stmt) {
    try {
      this.reader = stmt.columns().length > 0;
    } catch {
      this.reader = false;
    }
  }

  get(...params: unknown[]) {
    return this.stmt.get(...params);
  }

  all(...params: unknown[]) {
    return this.stmt.all(...params);
  }

  run(...params: unknown[]) {
    return this.stmt.run(...params);
  }
}

export default class SqliteCompatDatabase {
  private readonly db: DatabaseSync;

  constructor(path: string, options?: OpenSqliteOptions) {
    this.db = options?.readonly ? new DatabaseSync(path, { readOnly: true }) : new DatabaseSync(path);
  }

  pragma(source: string, options?: { simple?: boolean }): unknown {
    const trimmed = source.trim();
    if (options?.simple) {
      const row = this.db.prepare(`PRAGMA ${trimmed}`).get() as Record<string, unknown> | undefined;
      if (!row) return undefined;
      return Object.values(row)[0];
    }
    if (!trimmed.includes('=')) {
      return this.db.prepare(`PRAGMA ${trimmed}`).all();
    }
    this.db.exec(`PRAGMA ${trimmed}`);
    return undefined;
  }

  prepare(sql: string): SqliteCompatStatement {
    const stmt = this.db.prepare(sql);
    try {
      stmt.setAllowBareNamedParameters(true);
      stmt.setAllowUnknownNamedParameters(true);
    } catch {
      // older node:sqlite builds may not expose these helpers
    }
    return new SqliteCompatStatement(stmt);
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  transaction<T extends (...args: never[]) => unknown>(fn: T): T {
    const wrapped = (...args: Parameters<T>): ReturnType<T> => {
      this.db.exec('BEGIN');
      try {
        const result = fn(...args) as ReturnType<T>;
        this.db.exec('COMMIT');
        return result;
      } catch (error) {
        try {
          this.db.exec('ROLLBACK');
        } catch {
          // ignore rollback failure
        }
        throw error;
      }
    };
    return wrapped as T;
  }

  close(): void {
    this.db.close();
  }
}

export function createSqliteDatabase(path: string, options?: OpenSqliteOptions): SqliteCompatDatabase {
  return new SqliteCompatDatabase(path, options);
}

let betterSqlite3Loadable: boolean | null = null;

export function canLoadBetterSqlite3(): boolean {
  if (betterSqlite3Loadable !== null) return betterSqlite3Loadable;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BetterSqlite3 = require('better-sqlite3') as typeof import('better-sqlite3');
    const probe = new BetterSqlite3(':memory:');
    probe.close();
    betterSqlite3Loadable = true;
  } catch {
    betterSqlite3Loadable = false;
  }
  return betterSqlite3Loadable;
}

export function openSqliteDatabase(path: string, options?: OpenSqliteOptions): SqliteDatabase {
  if (canLoadBetterSqlite3()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const BetterSqlite3 = require('better-sqlite3') as typeof import('better-sqlite3');
      return new BetterSqlite3(path, options?.readonly ? { readonly: true } : undefined);
    } catch {
      betterSqlite3Loadable = false;
    }
  }
  return createSqliteDatabase(path, options);
}
