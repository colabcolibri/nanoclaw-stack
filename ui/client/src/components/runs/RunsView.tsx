import React, { useState, useEffect } from 'react'
import {
  Activity,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Send,
  Wrench,
  Sparkles,
  Brain,
  MessageSquare,
  Repeat,
  Eye,
  Copy,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Zap,
} from 'lucide-react'
import { ApiClient, type CronExecutionLog, type IntermediateRunItem } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export const RunsView: React.FC = () => {
  const [cronLogs, setCronLogs] = useState<CronExecutionLog[]>([])
  const [detailedRuns, setDetailedRuns] = useState<IntermediateRunItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [filterType, setFilterType] = useState<'all' | 'cron' | 'tools' | 'synthesis' | 'memo'>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)

  // Inspection Modal
  const [selectedRun, setSelectedRun] = useState<any | null>(null)

  useEffect(() => {
    loadRunsData()
  }, [])

  const loadRunsData = async () => {
    setIsLoading(true)
    try {
      const [cronRes, runsRes] = await Promise.all([
        ApiClient.getCronLogs().catch(() => ({ logs: [] })),
        ApiClient.getRuns(150).catch(() => ({ runs: [] })),
      ])
      setCronLogs(cronRes.logs || [])
      setDetailedRuns(runsRes.runs || [])
    } catch {
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {}
  }

  // Combine and normalize runs for uniform rendering
  const unifiedRuns = React.useMemo(() => {
    const list: any[] = []

    // 1. Cron executions
    cronLogs.forEach((c) => {
      list.push({
        id: c.id,
        kind: 'cron',
        category: 'Rotina Recorrente (Cron)',
        timestamp: c.timestamp,
        status: c.status || 'completed',
        cron: c.cron,
        channel: c.channelType || 'telegram',
        prompt: c.cleanPrompt || c.prompt,
        output: c.resultText,
        model: 'openai/gpt-oss-20b',
      })
    })

    // 2. Telemetry and API ledger runs
    detailedRuns.forEach((r) => {
      // Avoid duplicating the exact message if already in cron list
      const isTool = r.hasToolCalls || (r.toolCallsCount && r.toolCallsCount > 0)
      const isMemo = r.purpose === 'semantic_memo' || r.preview?.startsWith('Memo:')
      const isSynth = r.purpose === 'stage2_synthesis' || r.preview?.startsWith('Síntese:')
      const isFast = r.purpose === 'fast_path_direct'

      const kind = isMemo ? 'memo' : isTool ? 'tools' : isSynth ? 'synthesis' : 'model_turn'
      const category = isMemo
        ? 'Memória Semântica'
        : isTool
        ? `Ferramenta (${r.toolCallsCount || 1})`
        : isSynth
        ? 'Síntese Persona (Barão)'
        : isFast
        ? 'Conversação Direta'
        : 'Execução de Modelo'

      list.push({
        id: r.id,
        kind,
        category,
        timestamp: r.timestamp,
        status: 'completed',
        model: r.model,
        tokens: r.totalTokens || (r.promptTokens || 0) + (r.completionTokens || 0),
        promptTokens: r.promptTokens,
        completionTokens: r.completionTokens,
        costUsd: r.costUsd,
        costBrl: r.costBrl,
        latencyMs: r.latencyMs,
        prompt: r.preview || r.rawContent || '',
        output: r.rawContent || r.preview,
      })
    })

    // Sort newest first
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Apply Filter
    return list.filter((item) => {
      if (filterType !== 'all' && item.kind !== filterType) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchId = item.id?.toLowerCase().includes(q)
        const matchPrompt = item.prompt?.toLowerCase().includes(q)
        const matchOutput = item.output?.toLowerCase().includes(q)
        const matchCategory = item.category?.toLowerCase().includes(q)
        if (!matchId && !matchPrompt && !matchOutput && !matchCategory) return false
      }
      return true
    })
  }, [cronLogs, detailedRuns, filterType, searchQuery])

  return (
    <div className="flex flex-col gap-6 w-full flex-1">
      <PageHeader
        icon={<Activity className="w-5 h-5" />}
        title="Execuções & Histórico de Runs"
        subtitle="Auditoria completa e telemetria de disparos de cron, execuções de ferramentas e turnos do assistente."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={loadRunsData}
            disabled={isLoading}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>
        }
      />

      {/* FILTER BAR & SEARCH */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--bg-card)] border border-[var(--border-main)] p-3 rounded-xl shadow-2xs">
        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Todos ({unifiedRuns.length})
          </button>
          <button
            onClick={() => setFilterType('cron')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'cron'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Crons Periódicas ({cronLogs.length})
          </button>
          <button
            onClick={() => setFilterType('tools')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'tools'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Ferramentas & Ações
          </button>
          <button
            onClick={() => setFilterType('synthesis')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'synthesis'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Síntese Persona (Barão)
          </button>
          <button
            onClick={() => setFilterType('memo')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'memo'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Memórias Semânticas
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por texto ou ID..."
            className="w-full pl-8 pr-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] focus:outline-none focus:border-sky-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-main)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* RUNS LIST */}
      <Card className="border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs overflow-hidden w-full">
        <CardContent className="p-6 space-y-4">
          {unifiedRuns.length === 0 ? (
            <EmptyState
              icon={<Activity className="w-8 h-8 text-[var(--text-dim)]" />}
              title="Nenhuma execução encontrada"
              description="Nenhum log corresponde aos filtros de busca selecionados."
            />
          ) : (
            unifiedRuns.map((run) => {
              const isExpanded = expandedRunId === run.id

              let badgeColor = 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
              let icon = <Wrench className="w-4 h-4" />
              if (run.kind === 'cron') {
                badgeColor = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                icon = <Repeat className="w-4 h-4" />
              } else if (run.kind === 'synthesis') {
                badgeColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                icon = <Sparkles className="w-4 h-4" />
              } else if (run.kind === 'memo') {
                badgeColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                icon = <Brain className="w-4 h-4" />
              }

              return (
                <div
                  key={run.id}
                  className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card-subtle)] hover:border-[var(--border-accent)] transition-all flex flex-col gap-3 shadow-2xs"
                >
                  {/* Top Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-main)] pb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${badgeColor}`}>
                        {icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-xs font-bold text-[var(--text-main)] font-mono">{run.id}</strong>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeColor}`}>
                            {run.category}
                          </span>
                          <Badge variant="success" className="text-[10px] font-mono">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{run.status?.toUpperCase() || 'COMPLETED'}</span>
                          </Badge>
                          {run.cron && (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              <span>{run.cron}</span>
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-[var(--text-dim)] font-mono mt-1">
                          <span>{new Date(run.timestamp).toLocaleString('pt-BR')}</span>
                          {run.latencyMs && <span>• {run.latencyMs}ms</span>}
                          {run.tokens && <span>• {run.tokens.toLocaleString('pt-BR')} tokens</span>}
                          {run.costBrl && <span>• R$ {run.costBrl.toFixed(4)}</span>}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRun(run)}
                      className="h-8 gap-1.5 text-xs font-semibold shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detalhes da Run</span>
                    </Button>
                  </div>

                  {/* Prompt Text / Input */}
                  <div className="p-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-main)] text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase text-[var(--text-dim)] font-mono">
                        {run.kind === 'cron' ? 'Instrução do Cron:' : 'Conteúdo / Entrada:'}
                      </span>
                      {run.prompt && run.prompt.length > 180 && (
                        <button
                          onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                          className="text-[10px] font-semibold text-[var(--accent)] flex items-center gap-1 cursor-pointer hover:underline"
                        >
                          <span>{isExpanded ? 'Recolher' : 'Expandir'}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                    <p className={`text-[var(--text-main)] font-mono text-[11px] leading-relaxed ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
                      {run.prompt}
                    </p>
                  </div>

                  {/* Output / Result (if available) */}
                  {run.output && run.output !== run.prompt && (
                    <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs">
                      <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1 mb-1">
                        <Send className="w-3 h-3" />
                        <span>Saída / Ação Entregue:</span>
                      </span>
                      <p className={`text-[var(--text-main)] leading-relaxed text-[11px] ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
                        {run.output}
                      </p>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* DETAILED INSPECTION MODAL */}
      {selectedRun && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs cursor-pointer animate-in fade-in"
          onClick={() => setSelectedRun(null)}
        >
          <div
            className="w-full max-w-2xl bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] cursor-default animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-[var(--border-main)] bg-[var(--bg-card-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20 flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">Auditoria da Execução (Run)</h3>
                  <p className="text-xs font-mono text-[var(--text-dim)]">ID: {selectedRun.id}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRun(null)}
                className="w-8 h-8 p-0 text-[var(--text-dim)] hover:text-[var(--text-main)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs text-[var(--text-main)] leading-relaxed">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-3 border-b border-[var(--border-main)]">
                <div>
                  <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase font-mono block">Categoria</span>
                  <span className="font-bold text-[var(--accent)] font-mono">{selectedRun.category}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase font-mono block">Data & Hora</span>
                  <span className="font-bold font-mono">{new Date(selectedRun.timestamp).toLocaleString('pt-BR')}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase font-mono block">Modelo</span>
                  <span className="font-bold font-mono">{selectedRun.model || 'Padrão'}</span>
                </div>
              </div>

              {selectedRun.prompt && (
                <div>
                  <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase font-mono block mb-1">Entrada / Prompt:</span>
                  <div className="p-3.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-main)] whitespace-pre-wrap font-mono text-xs leading-relaxed text-[var(--text-main)]">
                    {selectedRun.prompt}
                  </div>
                </div>
              )}

              {selectedRun.output && (
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase font-mono block mb-1 flex items-center gap-1">
                    <Send className="w-3.5 h-3.5" />
                    <span>Saída / Resultado:</span>
                  </span>
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-main)]">
                    {selectedRun.output}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--border-main)] bg-[var(--bg-card-subtle)] flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(selectedRun.output || selectedRun.prompt, 'run-copy')}
                className="gap-1.5 text-xs font-semibold"
              >
                {copiedId === 'run-copy' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'run-copy' ? 'Copiado!' : 'Copiar Saída'}</span>
              </Button>

              <Button variant="default" size="sm" onClick={() => setSelectedRun(null)} className="text-xs font-bold">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
