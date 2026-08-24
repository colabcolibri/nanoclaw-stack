import React, { useEffect, useState } from 'react'
import {
  Activity,
  RefreshCw,
  CheckCircle2,
  Send,
  Wrench,
  Sparkles,
  Brain,
  Repeat,
  Eye,
  Copy,
  Check,
  X,
  SlidersHorizontal,
  AlertTriangle,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { ExpandableTextBlock } from '@/components/common/ExpandableTextBlock'
import { SearchInput } from '@/components/common/SearchInput'
import { EmptyState } from '@/components/common/EmptyState'
import { FilterChips } from '@/components/common/FilterChips'
import { PaginatedListSection } from '@/components/templates/PaginatedListSection'
import { DEFAULT_PAGE_SIZE, type PageSize } from '@/lib/pagination'
import { formatCount } from '@/lib/format-count'
import { buildRunFilterChips } from '@/components/runs/run-filters'
import { useRunsFeed, type RunFilterKind, type UnifiedRun } from '@/components/runs/useRunsFeed'
import { ApiClient, type RunFeedDetailItem } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/templates/StatusBadge'
import { Card, CardContent } from '@/components/ui/card'

export const RunsView: React.FC = () => {
  const [filterType, setFilterType] = useState<RunFilterKind>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedRun, setSelectedRun] = useState<UnifiedRun | null>(null)
  const [selectedRunDetail, setSelectedRunDetail] = useState<RunFeedDetailItem | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    setPage(1)
  }, [filterType, debouncedSearch, pageSize])

  const { items, counts, meta, reload, totalPages, rangeStart, rangeEnd } = useRunsFeed({
    page,
    pageSize,
    filterKind: filterType,
    searchQuery: debouncedSearch,
  })

  const filterChips = buildRunFilterChips(counts)

  const handleInspect = async (run: UnifiedRun) => {
    setSelectedRun(run)
    setSelectedRunDetail(null)
    if (!run.detailRef) return

    setIsDetailLoading(true)
    try {
      const { detail } = await ApiClient.getRunDetail({
        id: run.id,
        source: run.detailRef.source,
        sourceDb: run.detailRef.sourceDb,
      })
      setSelectedRunDetail(detail)
    } catch {
      setSelectedRunDetail(null)
    } finally {
      setIsDetailLoading(false)
    }
  }

  const handleCloseModal = () => {
    setSelectedRun(null)
    setSelectedRunDetail(null)
  }

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {}
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <PageHeader
        view="runs"
        subtitle="Auditoria completa e telemetria de disparos de cron, execuções de ferramentas e turnos do assistente."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={reload}
            disabled={meta.isLoading}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${meta.isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>
        }
      />

      {meta.scannedTotal > 0 && (
        <p className="text-xs text-(--text-muted)">
          {formatCount(meta.scannedTotal)} registros indexados no servidor
          {debouncedSearch.trim() && (
            <> · {formatCount(meta.total)} correspondem à busca</>
          )}
        </p>
      )}

      {meta.error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-800 dark:text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{meta.error}</p>
        </div>
      )}

      <div className="flex flex-col items-stretch justify-between gap-3 rounded-xl border border-(--border-main) bg-(--bg-card) p-3 shadow-2xs sm:flex-row sm:items-center">
        <FilterChips
          chips={filterChips}
          selected={filterType}
          onSelect={(id) => setFilterType(id as RunFilterKind)}
          className="gap-1.5"
        />

        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Filtrar por texto ou ID..."
          className="sm:max-w-xs"
        />
      </div>

      <Card className="w-full overflow-hidden border-(--border-main) bg-(--bg-card) shadow-xs">
        <CardContent className="space-y-4 p-6">
          {meta.isLoading && items.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-8 w-8 animate-pulse text-(--text-dim)" />}
              title="Carregando execuções..."
              description="Buscando registros no servidor."
            />
          ) : meta.total === 0 ? (
            <EmptyState
              icon={<Activity className="h-8 w-8 text-(--text-dim)" />}
              title="Nenhuma execução encontrada"
              description="Nenhum log corresponde aos filtros de busca selecionados."
            />
          ) : (
            <PaginatedListSection
              listClassName="space-y-4"
              page={page}
              totalPages={totalPages}
              totalItems={meta.total}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            >
              {items.map((run) => (
                <RunCard
                  key={run.id}
                  run={run}
                  onInspect={() => void handleInspect(run)}
                />
              ))}
            </PaginatedListSection>
          )}
        </CardContent>
      </Card>

      {selectedRun && (
        <RunInspectionModal
          run={selectedRun}
          detail={selectedRunDetail}
          isLoading={isDetailLoading}
          copiedId={copiedId}
          onClose={handleCloseModal}
          onCopy={handleCopy}
        />
      )}
    </div>
  )
}

function RunCard({
  run,
  onInspect,
}: {
  run: UnifiedRun
  onInspect: () => void
}) {
  let badgeColor = 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
  let icon = <Wrench className="h-4 w-4" />

  if (run.kind === 'cron') {
    badgeColor = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
    icon = <Repeat className="h-4 w-4" />
  } else if (run.kind === 'synthesis') {
    badgeColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    icon = <Sparkles className="h-4 w-4" />
  } else if (run.kind === 'memo') {
    badgeColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    icon = <Brain className="h-4 w-4" />
  } else if (run.kind === 'triage' || run.kind === 'supervisor') {
    badgeColor = 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20'
    icon = <Brain className="h-4 w-4" />
  } else if (run.kind === 'audit') {
    badgeColor = 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
    icon = <SlidersHorizontal className="h-4 w-4" />
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-(--border-main) bg-(--bg-card-subtle) p-4 shadow-2xs transition-all hover:border-(--border-primary)">
      <div className="flex flex-col justify-between gap-3 border-b border-(--border-main) pb-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${badgeColor}`}>
            {icon}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <strong className="font-mono text-xs font-bold text-(--text-main)">{run.id}</strong>
              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${badgeColor}`}>
                {run.category}
              </span>
              <StatusBadge className="font-mono text-[10px]">
                <CheckCircle2 className="h-3 w-3" />
                <span>{run.status?.toUpperCase() || 'COMPLETED'}</span>
              </StatusBadge>
              {run.cron && (
                <Badge variant="outline" className="font-mono text-[10px]">
                  <span>{run.cron}</span>
                </Badge>
              )}
            </div>
            <div className="mt-1 flex items-center gap-3 font-mono text-[11px] text-(--text-dim)">
              <span>{new Date(run.timestamp).toLocaleString('pt-BR')}</span>
              {run.latencyMs != null && <span>• {formatCount(run.latencyMs)}ms</span>}
              {run.tokens != null && <span>• {formatCount(run.tokens)} tokens</span>}
              {run.costBrl != null && <span>• R$ {run.costBrl.toFixed(4)}</span>}
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onInspect}
          className="h-8 shrink-0 gap-1.5 text-xs font-semibold"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Detalhes da run</span>
        </Button>
      </div>

      <div className="rounded-lg border border-(--border-main) bg-(--bg-input) p-3 text-xs">
        <span className="font-mono text-[10px] font-bold uppercase text-(--text-dim)">
          Resumo
        </span>
        <p className="mt-1 text-[11px] leading-relaxed text-(--text-muted)">
          {run.messageId ? (
            <>
              Mensagem: <span className="font-mono text-(--text-main)">{run.messageId}</span>
              {' · '}
            </>
          ) : null}
          Conteúdo completo disponível em detalhes da run.
        </p>
      </div>
    </div>
  )
}

function RunInspectionModal({
  run,
  detail,
  isLoading,
  copiedId,
  onClose,
  onCopy,
}: {
  run: UnifiedRun
  detail: RunFeedDetailItem | null
  isLoading: boolean
  copiedId: string | null
  onClose: () => void
  onCopy: (text: string, id: string) => void
}) {
  const display = detail ?? run
  const prompt = detail?.prompt
  const output = detail?.output
  return (
    <div
      className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/60 p-4 backdrop-blur-xs fade-in"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl cursor-default animate-in flex-col overflow-hidden rounded-2xl border border-(--border-main) bg-(--bg-card) shadow-2xl zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-(--border-main) bg-(--bg-card-subtle) p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-500">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-(--text-main)">Auditoria da execução (run)</h3>
              <p className="font-mono text-xs text-(--text-dim)">ID: {run.id}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 cursor-pointer p-0 text-(--text-dim) hover:text-(--text-main)"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 overflow-y-auto p-6 text-xs leading-relaxed text-(--text-main)">
          {isLoading && (
            <p className="text-(--text-muted)">Carregando conteúdo completo...</p>
          )}
          <div className="grid grid-cols-2 gap-3 border-b border-(--border-main) pb-3 sm:grid-cols-3">
            <div>
              <span className="block font-mono text-[10px] font-bold uppercase text-(--text-dim)">
                Categoria
              </span>
              <span className="font-mono font-bold text-primary">{display.category}</span>
            </div>
            <div>
              <span className="block font-mono text-[10px] font-bold uppercase text-(--text-dim)">
                Data & hora
              </span>
              <span className="font-mono font-bold">
                {new Date(display.timestamp).toLocaleString('pt-BR')}
              </span>
            </div>
            <div>
              <span className="block font-mono text-[10px] font-bold uppercase text-(--text-dim)">
                Modelo
              </span>
              <span className="font-mono font-bold">{display.model || 'Padrão'}</span>
            </div>
          </div>

          {prompt && (
            <div>
              <span className="mb-1 block font-mono text-[10px] font-bold uppercase text-(--text-dim)">
                Entrada / prompt:
              </span>
              <ExpandableTextBlock
                content={prompt}
                collapsedMaxHeight={160}
                preClassName="bg-(--bg-input) p-3.5 text-xs"
              />
            </div>
          )}

          {output && output !== prompt && (
            <div>
              <span className="mb-1 flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                <Send className="h-3.5 w-3.5" />
                <span>Saída / resultado:</span>
              </span>
              <ExpandableTextBlock
                content={output}
                collapsedMaxHeight={200}
                preClassName="border-emerald-500/20 bg-emerald-500/5 p-4 text-xs"
                mono={false}
              />
            </div>
          )}

          {!isLoading && !prompt && !output && (
            <p className="text-(--text-muted)">Nenhum conteúdo textual registrado para esta execução.</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-(--border-main) bg-(--bg-card-subtle) p-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCopy(output || prompt || '', 'run-copy')}
            disabled={!output && !prompt}
            className="gap-1.5 text-xs font-semibold"
          >
            {copiedId === 'run-copy' ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span>{copiedId === 'run-copy' ? 'Copiado!' : 'Copiar saída'}</span>
          </Button>

          <Button variant="default" size="sm" onClick={onClose} className="text-xs font-bold">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  )
}
