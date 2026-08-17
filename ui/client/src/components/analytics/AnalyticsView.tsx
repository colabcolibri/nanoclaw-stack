import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart3,
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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface AnalyticsViewProps {
  currency?: 'BRL' | 'USD'
  onToggleCurrency?: (c: 'BRL' | 'USD') => void
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  currency: parentCurrency,
}) => {
  const { t } = useTranslation('analytics')
  const [internalCurrency, setInternalCurrency] = useState<'BRL' | 'USD'>('BRL')
  const currency = parentCurrency || internalCurrency
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
      const usageData = await ApiClient.getUsage(200)
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

  return (
    <div className="flex flex-col gap-6 relative w-full">
      {/* Standard PageHeader */}
      <PageHeader
        icon={<BarChart3 className="w-5 h-5" />}
        title="Extrato & Consumo de Tokens"
        subtitle="Monitore a telemetria em tempo real, tokens de entrada/saída em colunas dedicadas e custos discriminados."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInternalCurrency(currency === 'BRL' ? 'USD' : 'BRL')}
              className="h-9 px-3 text-xs font-bold border-[var(--border-main)] bg-[var(--bg-card)] text-[var(--text-main)] hover:bg-[var(--bg-card-subtle)] gap-1.5 cursor-pointer shadow-xs"
            >
              <Coins className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Moeda: {currency}</span>
            </Button>

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
          </div>
        }
      />

      {/* Metric Breakdown Cards (Enhanced 4-Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Cost Card */}
        <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-dim)] flex items-center justify-between">
              <span>Custo Total Consolidado</span>
              <Coins className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 my-1.5 font-mono">
              {currency === 'BRL'
                ? `R$ ${stats?.estimatedCostBrl || '0.0000'}`
                : `$ ${stats?.estimatedCostUsd || '0.0000'}`}
            </div>
          </div>
          <div className="text-[11px] text-[var(--text-muted)] font-mono border-t border-[var(--border-main)] pt-2 mt-1">
            Cotação: R$ {exchangeRate.toFixed(4)} / USD
          </div>
        </div>

        {/* 2. Token In Card (Separated) */}
        <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300 flex items-center justify-between">
              <span>Tokens de Entrada (In)</span>
              <ArrowDownLeft className="w-4 h-4 text-sky-500" />
            </div>
            <div className="text-2xl font-bold text-sky-600 dark:text-sky-400 my-1.5 font-mono">
              {totalPromptTokens.toLocaleString()}
            </div>
          </div>
          <div className="text-[11px] text-[var(--text-muted)] font-mono border-t border-[var(--border-main)] pt-2 mt-1 flex items-center justify-between">
            <span>Custo Entrada:</span>
            <span className="font-bold text-sky-700 dark:text-sky-300">
              {formatCost(totalCostInUsd, totalCostInBrl)}
            </span>
          </div>
        </div>

        {/* 3. Token Out Card (Separated) */}
        <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center justify-between">
              <span>Tokens de Saída (Out)</span>
              <ArrowUpRight className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 my-1.5 font-mono">
              {totalCompletionTokens.toLocaleString()}
            </div>
          </div>
          <div className="text-[11px] text-[var(--text-muted)] font-mono border-t border-[var(--border-main)] pt-2 mt-1 flex items-center justify-between">
            <span>Custo Saída:</span>
            <span className="font-bold text-purple-700 dark:text-purple-300">
              {formatCost(totalCostOutUsd, totalCostOutBrl)}
            </span>
          </div>
        </div>

        {/* 4. Cache Efficiency & API Calls */}
        <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-dim)] flex items-center justify-between">
              <span>Cache & Requisições</span>
              <Cpu className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-[var(--text-main)] my-1.5 font-mono">
              {stats?.cacheHitRatio || '0%'} <span className="text-xs font-normal text-[var(--text-muted)]">hit ratio</span>
            </div>
          </div>
          <div className="text-[11px] text-[var(--text-muted)] font-mono border-t border-[var(--border-main)] pt-2 mt-1 flex items-center justify-between">
            <span>Total Requisições:</span>
            <span className="font-bold text-[var(--text-main)]">
              {stats?.totalApiCalls ?? stats?.totalMessages ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Main Unified Messages Table with Separated In / Out Columns */}
      <Card className="border-[var(--border-main)] bg-[var(--bg-card)] overflow-hidden shadow-xs">
        <CardContent className="p-0 overflow-x-auto">
          {messages.length === 0 ? (
            <EmptyState
              title="Sem registros de consumo"
              description="Nenhuma mensagem ou chamada de API foi registrada ainda."
            />
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-card-subtle)] border-b border-[var(--border-main)] text-[var(--text-muted)] font-mono">
                <tr>
                  <th className="p-3.5 px-4 font-bold">Tipo</th>
                  <th className="p-3.5 px-4 font-bold">Data & Hora</th>
                  <th className="p-3.5 px-4 font-bold">Canal</th>
                  <th className="p-3.5 px-4 font-bold">Remetente</th>
                  {/* Separate Token In Column */}
                  <th className="p-3.5 px-4 font-bold text-sky-700 dark:text-sky-300">
                    <div>Token In (Entrada)</div>
                    <div className="text-[10px] text-[var(--text-dim)] font-normal">Custo Entrada</div>
                  </th>
                  {/* Separate Token Out Column */}
                  <th className="p-3.5 px-4 font-bold text-purple-700 dark:text-purple-300">
                    <div>Token Out (Saída)</div>
                    <div className="text-[10px] text-[var(--text-dim)] font-normal">Custo Saída</div>
                  </th>
                  {/* Total Cost Column */}
                  <th className="p-3.5 px-4 font-bold text-emerald-700 dark:text-emerald-300">
                    <div>Custo Total</div>
                    <div className="text-[10px] text-[var(--text-dim)] font-normal">({currency})</div>
                  </th>
                  <th className="p-3.5 px-4 font-bold">Execução</th>
                  <th className="p-3.5 px-4 font-bold">Mensagem</th>
                  <th className="p-3.5 px-4 font-bold text-right">Auditar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-main)]">
                {messages.map((m) => {
                  const isUser = m.type === 'user'
                  const dateStr = new Date(m.timestamp).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  const subRunsCount = m.subRuns?.length || 0

                  // Calculate individual In and Out tokens and costs
                  const promptTokens = m.promptTokens ?? (isUser ? (m.tokens || 0) : Math.round((m.tokens || 0) * 0.7))
                  const completionTokens = m.completionTokens ?? (isUser ? 0 : Math.round((m.tokens || 0) * 0.3))
                  const costInUsd = m.costInUsd ?? ((promptTokens / 1_000_000) * 0.14)
                  const costOutUsd = m.costOutUsd ?? ((completionTokens / 1_000_000) * 0.28)
                  const costInBrl = m.costInBrl ?? (costInUsd * exchangeRate)
                  const costOutBrl = m.costOutBrl ?? (costOutUsd * exchangeRate)

                  return (
                    <tr
                      key={m.id}
                      onClick={() => setSelectedMessage(m)}
                      className="hover:bg-[var(--bg-card-subtle)] transition-colors cursor-pointer group"
                    >
                      <td className="p-3.5 px-4">
                        <Badge variant={isUser ? 'default' : 'success'} className="font-mono text-[10px]">
                          {isUser ? 'ENTRADA' : 'RESPOSTA'}
                        </Badge>
                      </td>
                      <td className="p-3.5 px-4 font-mono text-[var(--text-muted)] whitespace-nowrap">{dateStr}</td>
                      <td className="p-3.5 px-4 font-mono text-[var(--text-main)] font-semibold">{m.channel}</td>
                      <td className="p-3.5 px-4 font-semibold text-[var(--text-main)] whitespace-nowrap">{m.senderName}</td>

                      {/* 1. SEPARATE COLUMN: TOKEN IN + CUSTO IN */}
                      <td className="p-3.5 px-4 font-mono">
                        <div className="font-bold text-sky-600 dark:text-sky-400 text-xs">
                          {promptTokens.toLocaleString()} <span className="text-[10px] font-normal text-[var(--text-muted)]">in</span>
                        </div>
                        <div className="text-[10px] text-[var(--text-dim)] font-medium">
                          {formatCost(costInUsd, costInBrl)}
                        </div>
                      </td>

                      {/* 2. SEPARATE COLUMN: TOKEN OUT + CUSTO OUT */}
                      <td className="p-3.5 px-4 font-mono">
                        <div className="font-bold text-purple-600 dark:text-purple-400 text-xs">
                          {completionTokens.toLocaleString()} <span className="text-[10px] font-normal text-[var(--text-muted)]">out</span>
                        </div>
                        <div className="text-[10px] text-[var(--text-dim)] font-medium">
                          {formatCost(costOutUsd, costOutBrl)}
                        </div>
                      </td>

                      {/* 3. TOTAL COST COLUMN */}
                      <td className="p-3.5 px-4 font-mono">
                        <div className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                          {formatCost(m.costUsd, m.costBrl)}
                        </div>
                        <div className="text-[10px] text-[var(--text-dim)]">
                          {(m.tokens || (promptTokens + completionTokens)).toLocaleString()} total
                        </div>
                      </td>

                      <td className="p-3.5 px-4 whitespace-nowrap">
                        {subRunsCount > 0 ? (
                          <Badge variant="warning" className="gap-1 text-[10px]">
                            <Layers className="w-3 h-3" />
                            <span>{subRunsCount} tool(s)</span>
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Direta
                          </Badge>
                        )}
                      </td>
                      <td className="p-3.5 px-4 max-w-xs truncate text-[var(--text-main)] font-mono text-[11px]">
                        {m.text}
                      </td>
                      <td className="p-3.5 px-4 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 group-hover:text-[var(--accent)] cursor-pointer">
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Interactive Sheet / Drawer: Opens details & all intermediate runs of this message */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-end transition-opacity">
          <div className="w-full max-w-2xl bg-[var(--bg-card)] h-full border-l border-[var(--border-main)] p-6 flex flex-col justify-between shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200 text-[var(--text-main)]">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-[var(--border-main)] pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[var(--accent)]" />
                    <h3 className="text-lg font-bold text-[var(--text-main)]">Auditoria da Chamada & Sub-Runs</h3>
                  </div>
                  <p className="text-xs font-mono text-[var(--text-dim)]">ID: {selectedMessage.id}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedMessage(null)} className="h-8 w-8 p-0 cursor-pointer">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Interaction Summary Metrics with Distinct In/Out & Costs */}
              <div className="grid grid-cols-3 gap-3 font-mono">
                {/* Total Cost */}
                <div className="p-3.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)]">
                  <div className="text-[11px] text-[var(--text-dim)] uppercase font-bold">Custo Total</div>
                  <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {formatCost(selectedMessage.costUsd, selectedMessage.costBrl)}
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                    {(selectedMessage.tokens || 0).toLocaleString()} tokens
                  </div>
                </div>

                {/* Token In + Custo In */}
                <div className="p-3.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)]">
                  <div className="text-[11px] text-sky-700 dark:text-sky-300 uppercase font-bold flex items-center gap-1">
                    <ArrowDownLeft className="w-3 h-3 text-sky-500" />
                    <span>Token In</span>
                  </div>
                  <div className="text-base font-bold text-sky-600 dark:text-sky-400 mt-1">
                    {(selectedMessage.promptTokens || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                    Custo: {formatCost(selectedMessage.costInUsd, selectedMessage.costInBrl)}
                  </div>
                </div>

                {/* Token Out + Custo Out */}
                <div className="p-3.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)]">
                  <div className="text-[11px] text-purple-700 dark:text-purple-300 uppercase font-bold flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3 text-purple-500" />
                    <span>Token Out</span>
                  </div>
                  <div className="text-base font-bold text-purple-600 dark:text-purple-400 mt-1">
                    {(selectedMessage.completionTokens || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)] mt-0.5">
                    Custo: {formatCost(selectedMessage.costOutUsd, selectedMessage.costOutBrl)}
                  </div>
                </div>
              </div>

              {/* Message Content */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-[var(--text-main)] flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[var(--accent)]" />
                  <span>Conteúdo da Mensagem</span>
                </div>
                <div className="p-4 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)] text-xs text-[var(--text-main)] font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {selectedMessage.text}
                </div>
              </div>

              {/* Linked Intermediate Runs Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[var(--text-main)] flex items-center gap-2">
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
                        className="p-3.5 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card-subtle)] space-y-2 font-mono text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant={step.type === 'tool_execution' ? 'warning' : 'secondary'} className="text-[10px]">
                              Passo #{idx + 1} • {step.type === 'tool_execution' ? 'TOOL RUN' : 'SÍNTESE'}
                            </Badge>
                            {step.toolName && (
                              <span className="font-bold text-[var(--accent)] flex items-center gap-1">
                                <Wrench className="w-3 h-3 text-amber-500" />
                                <span>{step.toolName}</span>
                              </span>
                            )}
                          </div>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCost(step.costUsd, step.costBrl)}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-[var(--text-dim)] border-t border-[var(--border-main)] pt-2 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                            <span>{step.latencyMs ? `${step.latencyMs}ms` : '--'}</span>
                          </span>
                          <span className="text-sky-600 dark:text-sky-400 font-bold">
                            {(step.promptTokens || 0).toLocaleString()} in ({formatCost(step.costInUsd)})
                          </span>
                          <span className="text-purple-600 dark:text-purple-400 font-bold">
                            {(step.completionTokens || 0).toLocaleString()} out ({formatCost(step.costOutUsd)})
                          </span>
                          <span>Hit: {(step.cacheHitTokens || 0).toLocaleString()}</span>
                        </div>

                        {step.rawContent && (
                          <pre className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-main)] text-[11px] text-[var(--text-main)] whitespace-pre-wrap max-h-32 overflow-y-auto">
                            {step.rawContent}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card-subtle)] text-center text-xs text-[var(--text-dim)] font-mono">
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
