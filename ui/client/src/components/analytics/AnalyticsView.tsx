import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  RefreshCw,
  Wrench,
  ChevronRight,
  X,
  Clock,
  Layers,
  MessageSquare,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Cpu,
} from 'lucide-react'
import { ApiClient, type ChatMessage } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ExpandableTextBlock } from '@/components/common/ExpandableTextBlock'
import { PaginatedListSection } from '@/components/templates/PaginatedListSection'
import { usePagination } from '@/hooks/usePagination'
import { DEFAULT_PAGE_SIZE } from '@/lib/pagination'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/templates/StatusBadge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTimeShort, formatNumber } from '../../lib/formatters'


interface AnalyticsViewProps {
  currency?: 'BRL' | 'USD'
}


export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  currency = 'BRL',
}) => {
  const { t } = useTranslation('analytics')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const usageData = await ApiClient.getUsage(DEFAULT_PAGE_SIZE)
      setMessages(usageData.logs || [])
      setStats(usageData.stats || null)
    } catch {} finally {
      setIsLoading(false)
    }
  }

  const exchangeRate = Number(stats?.usdToBrlRate || 5.2014)

  const formatCost = (costUsd?: number, costBrl?: number) => {
    if (currency === 'BRL') {
      const brl = costBrl ?? Number(((costUsd || 0) * exchangeRate).toFixed(4))
      return `R$ ${brl.toFixed(4)}`
    }
    return `$ ${(costUsd || 0).toFixed(5)}`
  }

  // Calculate aggregate In / Out costs for the top summary cards
  const totalPromptTokens = Number(stats?.promptTokens || 0)
  const totalCompletionTokens = Number(stats?.completionTokens || 0)
  const totalCostInUsd = (totalPromptTokens / 1_000_000) * 0.14
  const totalCostOutUsd = (totalCompletionTokens / 1_000_000) * 0.28
  const totalCostInBrl = totalCostInUsd * exchangeRate
  const totalCostOutBrl = totalCostOutUsd * exchangeRate

  // Helper to format model badge with consistent styling
  const renderModelBadge = (model?: string) => {
    const m = model || stats?.modelName || 'deepseek-v4-flash'
    const lower = m.toLowerCase()
    const isDeepSeek = lower.includes('deepseek')
    const isOpenAi = lower.includes('openai') || lower.includes('gpt')
    const isGroq = lower.includes('groq') || lower.includes('llama')
    const isClaude = lower.includes('claude') || lower.includes('anthropic')

    let colorClasses = 'border-slate-500/20 bg-slate-500/10 text-slate-400'
    if (isDeepSeek) {
      colorClasses = 'border-sky-500/30 bg-sky-500/10 text-sky-400 dark:text-sky-300'
    } else if (isOpenAi) {
      colorClasses = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 dark:text-emerald-300'
    } else if (isGroq) {
      colorClasses = 'border-amber-500/30 bg-amber-500/10 text-amber-400 dark:text-amber-300'
    } else if (isClaude) {
      colorClasses = 'border-orange-500/30 bg-orange-500/10 text-orange-400 dark:text-orange-300'
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-mono font-medium whitespace-nowrap ${colorClasses}`}>
        <Cpu className="w-3 h-3 opacity-80" />
        <span>{m}</span>
      </span>
    )
  }

  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalItems,
    totalPages,
    paginatedItems,
    rangeStart,
    rangeEnd,
  } = usePagination(messages)

  return (
    <div className="flex flex-col gap-6 relative w-full">
      {/* Standard PageHeader */}
      <PageHeader
        view="usage"
        subtitle="Monitore a telemetria em tempo real, tokens de entrada/saída, modelos utilizados e custos discriminados."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="h-9 gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>
        }
      />

      {/* Metric Breakdown Cards (Enhanced 4-Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-xs">
          <CardContent className="p-4 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-(--text-dim) flex items-center justify-between">
                <span>Custo total consolidado</span>
                <Coins className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 my-1.5 font-mono">
                {currency === 'BRL'
                  ? `R$ ${stats?.estimatedCostBrl || '0.0000'}`
                  : `$ ${stats?.estimatedCostUsd || '0.0000'}`}
              </div>
            </div>
            <div className="text-[11px] text-(--text-muted) font-mono border-t border-(--border-main) pt-2 mt-1 flex items-center justify-between">
              <span>Cotação: R$ {exchangeRate.toFixed(4)}</span>
              <span className="text-[10px] text-primary truncate max-w-30" title={stats?.modelName}>
                {stats?.modelName || 'deepseek-v4-flash'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardContent className="p-4 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300 flex items-center justify-between">
                <span>Tokens de entrada (in)</span>
                <ArrowDownLeft className="w-4 h-4 text-sky-500" />
              </div>
              <div className="text-2xl font-bold text-sky-600 dark:text-sky-400 my-1.5 font-mono">
                {formatNumber(totalPromptTokens)}
              </div>
            </div>
            <div className="text-[11px] text-(--text-muted) font-mono border-t border-(--border-main) pt-2 mt-1 flex items-center justify-between">
              <span>Custo entrada:</span>
              <span className="font-bold text-sky-700 dark:text-sky-300">
                {formatCost(totalCostInUsd, totalCostInBrl)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardContent className="p-4 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center justify-between">
                <span>Tokens de saída (out)</span>
                <ArrowUpRight className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 my-1.5 font-mono">
                {formatNumber(totalCompletionTokens)}
              </div>
            </div>
            <div className="text-[11px] text-(--text-muted) font-mono border-t border-(--border-main) pt-2 mt-1 flex items-center justify-between">
              <span>Custo saída:</span>
              <span className="font-bold text-purple-700 dark:text-purple-300">
                {formatCost(totalCostOutUsd, totalCostOutBrl)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardContent className="p-4 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-(--text-dim) flex items-center justify-between">
                <span>Cache & requisições</span>
                <Cpu className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-(--text-main) my-1.5 font-mono">
                {stats?.cacheHitRatio || '0%'}{' '}
                <span className="text-xs font-normal text-(--text-muted)">hit ratio</span>
              </div>
            </div>
            <div className="text-[11px] text-(--text-muted) font-mono border-t border-(--border-main) pt-2 mt-1 flex items-center justify-between">
              <span>Total requisições:</span>
              <span className="font-bold text-(--text-main)">
                {stats?.totalApiCalls ?? stats?.totalMessages ?? 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Unified Messages Table with Generous Widths */}
      <Card className="border-(--border-main) bg-(--bg-card) overflow-hidden shadow-xs">
        <CardContent className="p-0 overflow-x-auto">
          {messages.length === 0 ? (
            <EmptyState
              title="Sem registros de consumo"
              description="Nenhuma mensagem ou chamada de API foi registrada ainda."
            />
          ) : (
            <PaginatedListSection
              className="px-6 pt-4"
              listClassName="overflow-x-auto -mx-6 px-6"
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            >
            <Table className="text-xs min-w-295">
              <TableHeader className="bg-(--bg-card-subtle)">
                <TableRow>
                  <TableHead className="min-w-23.75">Tipo</TableHead>
                  <TableHead className="min-w-31.25">Data & hora</TableHead>
                  <TableHead className="min-w-21.25">Canal</TableHead>
                  <TableHead className="min-w-30">Remetente</TableHead>
                  <TableHead className="min-w-36.25">
                    <div className="flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5 text-primary" />
                      <span>Modelo</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-sky-700 dark:text-sky-300 min-w-33.75">
                    <div>Token in (entrada)</div>
                    <div className="text-[10px] text-(--text-dim) font-normal normal-case">Custo entrada</div>
                  </TableHead>
                  <TableHead className="text-purple-700 dark:text-purple-300 min-w-33.75">
                    <div>Token out (saída)</div>
                    <div className="text-[10px] text-(--text-dim) font-normal normal-case">Custo saída</div>
                  </TableHead>
                  <TableHead className="text-emerald-700 dark:text-emerald-300 min-w-31.25">
                    <div>Custo total</div>
                    <div className="text-[10px] text-(--text-dim) font-normal normal-case">({currency})</div>
                  </TableHead>
                  <TableHead className="min-w-37.5">Execução</TableHead>
                  <TableHead className="min-w-45">Mensagem</TableHead>
                  <TableHead className="text-right min-w-17.5">Auditar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((m) => {
                  const isUser = m.type === 'user'
                  const dateStr = formatDateTimeShort(m.timestamp)
                  const subRunsCount = m.subRuns?.length || 0

                  // Calculate individual In and Out tokens and costs
                  const promptTokens = m.promptTokens ?? (isUser ? (m.tokens || 0) : Math.round((m.tokens || 0) * 0.7))
                  const completionTokens = m.completionTokens ?? (isUser ? 0 : Math.round((m.tokens || 0) * 0.3))
                  const costInUsd = m.costInUsd ?? ((promptTokens / 1_000_000) * 0.14)
                  const costOutUsd = m.costOutUsd ?? ((completionTokens / 1_000_000) * 0.28)
                  const costInBrl = m.costInBrl ?? (costInUsd * exchangeRate)
                  const costOutBrl = m.costOutBrl ?? (costOutUsd * exchangeRate)

                  return (
                    <TableRow
                      key={m.id}
                      onClick={() => setSelectedMessage(m)}
                      className="cursor-pointer group"
                    >
                      <TableCell>
                        {isUser ? (
                          <Badge variant="default" className="font-mono text-[10px]">
                            ENTRADA
                          </Badge>
                        ) : (
                          <StatusBadge className="font-mono text-[10px]">
                            RESPOSTA
                          </StatusBadge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-(--text-muted) whitespace-nowrap">{dateStr}</TableCell>
                      <TableCell className="font-mono font-semibold">{m.channel}</TableCell>
                      <TableCell className="font-semibold whitespace-nowrap">{m.senderName}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {renderModelBadge(m.model)}
                      </TableCell>
                      <TableCell className="font-mono">
                        <div className="font-bold text-sky-600 dark:text-sky-400 text-xs">
                          {formatNumber(promptTokens)} <span className="text-[10px] font-normal text-(--text-muted)">in</span>
                        </div>
                        <div className="text-[10px] text-(--text-dim) font-medium">
                          {formatCost(costInUsd, costInBrl)}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        <div className="font-bold text-purple-600 dark:text-purple-400 text-xs">
                          {formatNumber(completionTokens)} <span className="text-[10px] font-normal text-(--text-muted)">out</span>
                        </div>
                        <div className="text-[10px] text-(--text-dim) font-medium">
                          {formatCost(costOutUsd, costOutBrl)}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        <div className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                          {formatCost(m.costUsd, m.costBrl)}
                        </div>
                        <div className="text-[10px] text-(--text-dim)">
                          {(m.tokens || (promptTokens + formatNumber(completionTokens)))} total
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {subRunsCount > 0 ? (
                          <StatusBadge variant="warning" className="gap-1 text-[10px] py-1 px-2.5">
                            <Layers className="w-3 h-3" />
                            <span>{subRunsCount} tool(s) executadas</span>
                          </StatusBadge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] py-1 px-2.5">
                            Resposta Direta
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate font-mono text-[11px]">
                        {m.text}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 group-hover:text-primary cursor-pointer">
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            </PaginatedListSection>
          )}
        </CardContent>
      </Card>

      {/* Interactive Sheet / Drawer: Opens details & all intermediate runs of this message */}
      {selectedMessage && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-end transition-opacity cursor-pointer"
          onClick={() => setSelectedMessage(null)}
        >
          <div
            className="w-full max-w-2xl bg-(--bg-card) h-full border-l border-(--border-main) p-6 flex flex-col justify-between shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200 text-(--text-main) cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-(--border-main) pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-bold text-(--text-main)">Auditoria da Chamada & Sub-Runs</h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono text-(--text-dim)">
                    <span>ID: {selectedMessage.id}</span>
                    <span>•</span>
                    <span className="text-primary font-semibold">
                      Modelo: {selectedMessage.model || stats?.modelName || 'deepseek-v4-flash'}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedMessage(null)} className="h-8 w-8 p-0 cursor-pointer">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Interaction Summary Metrics with Distinct In/Out & Costs & Model */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                {/* Model Card */}
                <div className="p-3 rounded-xl bg-(--bg-card-subtle) border border-(--border-main) flex flex-col justify-between">
                  <div className="text-[10px] text-(--text-dim) uppercase font-bold flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-primary" />
                    <span>Modelo</span>
                  </div>
                  <div className="text-xs font-bold text-(--text-main) mt-1 truncate" title={selectedMessage.model || stats?.modelName}>
                    {selectedMessage.model || stats?.modelName || 'deepseek-v4-flash'}
                  </div>
                  <div className="text-[10px] text-(--text-dim) mt-0.5">
                    {selectedMessage.channel}
                  </div>
                </div>

                {/* Total Cost */}
                <div className="p-3 rounded-xl bg-(--bg-card-subtle) border border-(--border-main) flex flex-col justify-between">
                  <div className="text-[10px] text-(--text-dim) uppercase font-bold">Custo Total</div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {formatCost(selectedMessage.costUsd, selectedMessage.costBrl)}
                  </div>
                  <div className="text-[10px] text-(--text-dim) mt-0.5">
                    {(selectedMessage.tokens || formatNumber(0))} tokens
                  </div>
                </div>

                {/* Token In + Custo In */}
                <div className="p-3 rounded-xl bg-(--bg-card-subtle) border border-(--border-main) flex flex-col justify-between">
                  <div className="text-[10px] text-sky-700 dark:text-sky-300 uppercase font-bold flex items-center gap-1">
                    <ArrowDownLeft className="w-3 h-3 text-sky-500" />
                    <span>Token In</span>
                  </div>
                  <div className="text-sm font-bold text-sky-600 dark:text-sky-400 mt-1">
                    {(selectedMessage.promptTokens || formatNumber(0))}
                  </div>
                  <div className="text-[10px] text-(--text-dim) mt-0.5">
                    {formatCost(selectedMessage.costInUsd, selectedMessage.costInBrl)}
                  </div>
                </div>

                {/* Token Out + Custo Out */}
                <div className="p-3 rounded-xl bg-(--bg-card-subtle) border border-(--border-main) flex flex-col justify-between">
                  <div className="text-[10px] text-purple-700 dark:text-purple-300 uppercase font-bold flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3 text-purple-500" />
                    <span>Token Out</span>
                  </div>
                  <div className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-1">
                    {(selectedMessage.completionTokens || formatNumber(0))}
                  </div>
                  <div className="text-[10px] text-(--text-dim) mt-0.5">
                    {formatCost(selectedMessage.costOutUsd, selectedMessage.costOutBrl)}
                  </div>
                </div>
              </div>

              {/* Message Content */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-(--text-main) flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <span>Conteúdo da Mensagem</span>
                </div>
                <ExpandableTextBlock
                  content={selectedMessage.text || ''}
                  collapsedMaxHeight={160}
                  preClassName="bg-(--bg-card-subtle) p-4 text-xs"
                />
              </div>

              {/* Linked Intermediate Runs Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-(--text-main) flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-500" />
                    <span>Passos Intermediários / Execuções de Ferramentas ({selectedMessage.subRuns?.length || 0})</span>
                  </div>
                </div>

                {selectedMessage.subRuns && selectedMessage.subRuns.length > 0 ? (
                  <div className="space-y-2.5">
                    {[...selectedMessage.subRuns]
                      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                      .map((step, idx) => (
                      <div
                        key={step.id || idx}
                        className="p-3.5 rounded-xl border border-(--border-main) bg-(--bg-card-subtle) space-y-2 font-mono text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            {step.type === 'memo_generation' ? (
                              <Badge variant="outline" className="text-[10px] bg-purple-500/15 border-purple-500/30 text-purple-600 dark:text-purple-300 font-bold gap-1">
                                <Sparkles className="w-3 h-3 text-purple-500" />
                                Passo #{idx + 1} • MEMO SEMÂNTICO
                              </Badge>
                            ) : step.type === 'tool_execution' ? (
                              <StatusBadge variant="warning" className="text-[10px] gap-1">
                                <Wrench className="w-3 h-3" />
                                Passo #{idx + 1} • TOOL RUN ({step.toolName || 'Ferramenta'})
                              </StatusBadge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] gap-1 bg-sky-500/15 border border-sky-500/30 text-sky-700 dark:text-sky-300">
                                <MessageSquare className="w-3 h-3 text-sky-500" />
                                Passo #{idx + 1} • {(step.label || step.shortLabel || step.purpose || step.type || 'modelo').toUpperCase()}
                              </Badge>
                            )}
                            {step.model && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-(--bg-card) border border-(--border-main) text-(--text-main) font-semibold flex items-center gap-1">
                                <Cpu className="w-2.5 h-2.5 opacity-70 text-primary" />
                                <span>{step.model}</span>
                              </span>
                            )}
                            {step.toolName && (
                              <span className="font-bold text-primary flex items-center gap-1">
                                <Wrench className="w-3 h-3 text-amber-500" />
                                <span>{step.toolName}</span>
                              </span>
                            )}
                          </div>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCost(step.costUsd, step.costBrl)}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-(--text-dim) border-t border-(--border-main) pt-2 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-(--text-muted)" />
                            <span>{step.latencyMs ? `${step.latencyMs}ms` : '--'}</span>
                          </span>
                          <span className="text-sky-600 dark:text-sky-400 font-bold">
                            {(step.promptTokens || formatNumber(0))} in ({formatCost(step.costInUsd)})
                          </span>
                          <span className="text-purple-600 dark:text-purple-400 font-bold">
                            {(step.completionTokens || formatNumber(0))} out ({formatCost(step.costOutUsd)})
                          </span>
                          <span>Hit: {(step.cacheHitTokens || formatNumber(0))}</span>
                        </div>

                        {(step.rawContent || step.preview) && (
                          <ExpandableTextBlock
                            content={step.rawContent || step.preview || ''}
                            collapsedMaxHeight={128}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-(--border-main) bg-(--bg-card-subtle) text-center text-xs text-(--text-dim) font-mono">
                    Esta mensagem foi processada em resposta direta sem ferramentas intermediárias adicionais.
                  </div>
                )}
              </div>
            </div>

            <Button
              variant="default"
              className="w-full mt-6 font-bold cursor-pointer"
              onClick={() => setSelectedMessage(null)}
            >
              Fechar Auditoria
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
