import { Database } from "bun:sqlite";
import type { SQLQueryBindings } from "bun:sqlite";
import { openRunsIndexDb } from "./db.js";
import { emptyKindCounts, incrementKindCount } from "./kind.js";
import type {
  RunFilterKind,
  RunKindCounts,
  RunListItem,
  RunsFeedQuery,
  RunsFeedResponse,
} from "./types.js";
import { syncRunsIndex } from "./sync.js";

function rowToListItem(row: Record<string, unknown>): RunListItem {
  return {
    id: String(row.id),
    kind: row.kind as RunListItem["kind"],
    category: String(row.category),
    timestamp: String(row.timestamp),
    status: String(row.status),
    model: row.model ? String(row.model) : undefined,
    tokens: row.tokens != null ? Number(row.tokens) : undefined,
    costBrl: row.cost_brl != null ? Number(row.cost_brl) : undefined,
    latencyMs: row.latency_ms != null ? Number(row.latency_ms) : undefined,
    messageId: row.message_id ? String(row.message_id) : undefined,
    detailRef: {
      source: row.source as RunListItem["detailRef"]["source"],
      sourceDb: String(row.source_db),
    },
  };
}

function loadKindCounts(db: Database, searchPattern: string | null): RunKindCounts {
  const counts = emptyKindCounts();
  const rows = searchPattern
    ? (db
        .query(
          `SELECT kind, COUNT(*) AS count
           FROM runs_index
           WHERE search_text LIKE ?
           GROUP BY kind`,
        )
        .all(searchPattern) as Array<{ kind: string; count: number }>)
    : (db
        .query(
          `SELECT kind, COUNT(*) AS count
           FROM runs_index
           GROUP BY kind`,
        )
        .all() as Array<{ kind: string; count: number }>);

  for (const row of rows) {
    incrementKindCount(counts, row.kind as RunListItem["kind"]);
    counts.all += row.count;
  }

  return counts;
}

function countFiltered(
  db: Database,
  kind: RunFilterKind,
  searchPattern: string | null,
): number {
  const clauses: string[] = [];
  const params: SQLQueryBindings[] = [];

  if (kind !== "all") {
    clauses.push("kind = ?");
    params.push(kind);
  }
  if (searchPattern) {
    clauses.push("search_text LIKE ?");
    params.push(searchPattern);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const row = db.query(`SELECT COUNT(*) AS count FROM runs_index ${where}`).get(...params) as {
    count: number;
  };
  return row?.count ?? 0;
}

export function queryRunsFeedFromIndex(raw: RunsFeedQuery = {}): RunsFeedResponse {
  const { syncedAt } = syncRunsIndex(raw.groupFolder);

  const offset = Math.max(0, raw.offset ?? 0);
  const limit = Math.min(Math.max(1, raw.limit ?? 96), 500);
  const kind = raw.kind ?? "all";
  const q = raw.q?.trim() ?? "";
  const searchPattern = q ? `%${q.toLowerCase()}%` : null;

  const db = openRunsIndexDb();
  try {
    const counts = loadKindCounts(db, searchPattern);
    const total = countFiltered(db, kind, searchPattern);

    const clauses: string[] = [];
    const params: SQLQueryBindings[] = [];

    if (kind !== "all") {
      clauses.push("kind = ?");
      params.push(kind);
    }
    if (searchPattern) {
      clauses.push("search_text LIKE ?");
      params.push(searchPattern);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = db
      .query(
        `SELECT id, source, source_db, kind, category, timestamp, status,
                model, tokens, cost_brl, latency_ms, message_id
         FROM runs_index
         ${where}
         ORDER BY timestamp DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as Array<Record<string, unknown>>;

    const scannedRow = db.query("SELECT COUNT(*) AS count FROM runs_index").get() as {
      count: number;
    };

    return {
      items: rows.map(rowToListItem),
      total,
      offset,
      limit,
      hasMore: offset + rows.length < total,
      counts,
      scannedTotal: scannedRow?.count ?? 0,
      indexSyncedAt: syncedAt,
    };
  } finally {
    db.close();
  }
}
