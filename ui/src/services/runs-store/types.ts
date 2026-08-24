/** Tipos do índice de execuções — SQL portável (SQLite hoje, MySQL depois). */

export type RunSource = "ledger" | "audit" | "cron";

export type RunFilterKind =
  | "all"
  | "cron"
  | "tools"
  | "triage"
  | "supervisor"
  | "synthesis"
  | "memo"
  | "audit";

export type RunIndexKind = RunFilterKind | "model_turn" | "fast";

export interface RunIndexRow {
  id: string;
  source: RunSource;
  sourceDb: string;
  kind: RunIndexKind;
  category: string;
  timestamp: string;
  status: string;
  model: string | null;
  tokens: number | null;
  costBrl: number | null;
  latencyMs: number | null;
  messageId: string | null;
  searchText: string;
}

export interface RunDetailRef {
  source: RunSource;
  sourceDb: string;
}

export interface RunListItem {
  id: string;
  kind: RunIndexKind;
  category: string;
  timestamp: string;
  status: string;
  model?: string;
  tokens?: number;
  costBrl?: number;
  latencyMs?: number;
  messageId?: string;
  detailRef: RunDetailRef;
}

export interface RunDetailItem extends RunListItem {
  cron?: string;
  channel?: string;
  agent?: string;
  department?: string;
  supervisorStep?: number;
  decision?: string;
  prompt?: string;
  output?: string;
  auditMetadata?: Record<string, unknown>;
}

export type RunKindCounts = Record<RunFilterKind, number>;

export interface RunsFeedQuery {
  offset?: number;
  limit?: number;
  kind?: RunFilterKind;
  q?: string;
  groupFolder?: string;
}

export interface RunsFeedResponse {
  items: RunListItem[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  counts: RunKindCounts;
  scannedTotal: number;
  indexSyncedAt: string | null;
}
