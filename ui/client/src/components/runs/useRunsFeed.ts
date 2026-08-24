import { useCallback, useEffect, useState } from 'react'
import { ApiClient, type RunFeedListItem } from '@/api/client'
import type { RunFilterKind, RunKindCounts, UnifiedRun } from '@/components/runs/unified-runs'
import type { PageSize } from '@/lib/pagination'

export interface RunsFeedMeta {
  total: number
  scannedTotal: number
  hasMore: boolean
  isLoading: boolean
  error: string | null
  indexSyncedAt: string | null
}

interface RunsFeedState {
  items: UnifiedRun[]
  counts: RunKindCounts
  meta: RunsFeedMeta
}

const EMPTY_COUNTS: RunKindCounts = {
  all: 0,
  cron: 0,
  tools: 0,
  triage: 0,
  supervisor: 0,
  synthesis: 0,
  memo: 0,
  audit: 0,
}

function toUnifiedRun(item: RunFeedListItem): UnifiedRun {
  return {
    id: item.id,
    kind: item.kind as UnifiedRun['kind'],
    category: item.category,
    timestamp: item.timestamp,
    status: item.status,
    model: item.model,
    tokens: item.tokens,
    costBrl: item.costBrl,
    latencyMs: item.latencyMs,
    messageId: item.messageId,
    detailRef: item.detailRef,
  }
}

export interface UseRunsFeedParams {
  page: number
  pageSize: PageSize
  filterKind: RunFilterKind
  searchQuery: string
}

export function useRunsFeed({ page, pageSize, filterKind, searchQuery }: UseRunsFeedParams) {
  const [state, setState] = useState<RunsFeedState>({
    items: [],
    counts: EMPTY_COUNTS,
    meta: {
      total: 0,
      scannedTotal: 0,
      hasMore: false,
      isLoading: false,
      error: null,
      indexSyncedAt: null,
    },
  })

  const offset = (page - 1) * pageSize

  const load = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      meta: { ...prev.meta, isLoading: true, error: null },
    }))

    try {
      const response = await ApiClient.getRunsFeed({
        offset,
        limit: pageSize,
        kind: filterKind,
        q: searchQuery.trim() || undefined,
      })

      setState({
        items: response.items.map(toUnifiedRun),
        counts: response.counts as RunKindCounts,
        meta: {
          total: response.total,
          scannedTotal: response.scannedTotal,
          hasMore: response.hasMore,
          isLoading: false,
          error: null,
          indexSyncedAt: response.indexSyncedAt,
        },
      })
    } catch {
      setState((prev) => ({
        ...prev,
        meta: {
          ...prev.meta,
          isLoading: false,
          error: 'Não foi possível carregar as execuções.',
        },
      }))
    }
  }, [offset, pageSize, filterKind, searchQuery])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(state.meta.total / pageSize))
  const rangeStart = state.meta.total === 0 ? 0 : offset + 1
  const rangeEnd = Math.min(offset + state.items.length, state.meta.total)

  return {
    items: state.items,
    counts: state.counts,
    meta: state.meta,
    reload: load,
    totalPages,
    rangeStart,
    rangeEnd,
  }
}

export type { UnifiedRun, RunFilterKind }
