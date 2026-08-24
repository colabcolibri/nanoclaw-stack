import fs from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";
import { CONFIG } from "../../config.js";
import { RUNS_INDEX_DDL } from "./schema.js";

/** Abre o índice central — hoje SQLite; trocar driver para MySQL mantendo o mesmo schema. */
export function openRunsIndexDb(): Database {
  if (!fs.existsSync(CONFIG.DATA_PATH)) {
    fs.mkdirSync(CONFIG.DATA_PATH, { recursive: true });
  }
  const dbPath = path.join(CONFIG.DATA_PATH, "runs_index.db");
  const db = new Database(dbPath);
  db.run(RUNS_INDEX_DDL);
  return db;
}

export function getRunsIndexPath(): string {
  return path.join(CONFIG.DATA_PATH, "runs_index.db");
}

export function setIndexMeta(db: Database, key: string, value: string): void {
  db.run(
    "INSERT OR REPLACE INTO runs_index_meta (key, value) VALUES (?, ?)",
    [key, value],
  );
}

export function getIndexMeta(db: Database, key: string): string | null {
  const row = db.query("SELECT value FROM runs_index_meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function fileMtimeMs(filePath: string): number | null {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return null;
  }
}

export function isSourceFresh(db: Database, sourceKey: string, mtimeMs: number | null): boolean {
  if (mtimeMs == null) return false;
  const row = db
    .query("SELECT source_mtime_ms FROM runs_sync_state WHERE source_key = ?")
    .get(sourceKey) as { source_mtime_ms: number } | undefined;
  return row?.source_mtime_ms === mtimeMs;
}

export function markSourceSynced(
  db: Database,
  sourceKey: string,
  mtimeMs: number,
  rowCount: number,
): void {
  db.run(
    `INSERT OR REPLACE INTO runs_sync_state (source_key, source_mtime_ms, row_count, synced_at)
     VALUES (?, ?, ?, ?)`,
    [sourceKey, mtimeMs, rowCount, new Date().toISOString()],
  );
}

export function deleteSourceRows(db: Database, sourceKey: string): void {
  db.run("DELETE FROM runs_index WHERE source_db = ?", [sourceKey]);
}
