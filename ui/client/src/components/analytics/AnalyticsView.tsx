import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart3,
  RefreshCw,
  Wrench,
  ChevronRight,
  X,
  Clock,
  Zap,
  Layers,
  MessageSquare,
  Sparkles,
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
  onToggleCurrency,
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

  return (
    <div className="flex flex-col gap-6 relative">
      {/* Standard PageHeader */}
      <PageHeader
        icon={<BarChart3 className="w-5 h-5" />}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="h-8 gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>
        }
      />

      {/* Metric Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cost Card */}
        <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs">
          <div className="text-xs font-semibold text-[var(--text-muted)]">
            {currency === 'BRL' ? 'Custo Total (BRL)' : 'Custo Total (USD)'}
          </div>
          <div className="text-2xl font-bold text-emerald-500 my-1 font-mono">
            {currency === 'BRL'
              ? `R$ ${stats?.estimatedCostBrl || '0.0000'}`
              : `$ ${stats?.estimatedCostUsd || '0.0000'}`}
          </div>
          <div className="text-[11px] text-[var(--text-dim)] font-mono">
            {currency === 'BRL'
              ? `Cotação oficial: R$ ${exchangeRate.toFixed(4)} / USD`
              : 'DeepSeek V4 Flash Peak Pricing'}
          </div>
        </div>

        {/* Tokens In / Out Separated Card */}
        <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs">
          <div className="text-xs font-semibold text-[var(--text-muted)]">Tokens (Entrada / Saída)</div>
          <div className="text-lg sm:text-xl font-bold text-[var(--text-main)] my-1 font-mono flex items-center gap-1.5 flex-wrap">
            <span className="text-sky-500 font-bold" title="Tokens de Entrada (Prompt)">
              {((stats?.promptTokens || 0)).toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">in</span>
            </span>
            <span className="text-[var(--text-dim)]">•</span>
            <span className="text-purple-500 font-bold" title="Tokens de Saída (Completion)">
              {((stats?.completionTokens || 0)).toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">out</span>
            </span>
          </div>
          <div className="text-[11px] text-[var(--text-dim)] font-mono">
            Total: {(stats?.totalTokens ?? stats?.estimatedTokens ?? 0).toLocaleString()} • Cache Hit: {stats?.cacheHitRatio || '0%'}
          </div>
        </div>

        {/* Total Calls */}
        <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs">
          <div className="text-xs font-semibold text-[var(--text-muted)]">Chamadas de API</div>
          <div className="text-2xl font-bold text-[var(--text-main)] my-1 font-mono">
            {stats?.totalApiCalls ?? stats?.totalMessages ?? 0}
          </div>
          <div className="text-[11px] text-[var(--text-dim)] font-mono">
            {stats?.totalRuns || 0} execuções de ferramentas
          </div>
        </div>

        {/* Base Rate Card */}
        <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs">
          <div className="text-xs font-semibold text-[var(--text-muted)]">{t('baseRate')}</div>
          <div className="text-sm font-bold text-emerald-500 my-1">
            DeepSeek V4 Flash (Peak)
          </div>
          <div className="text-[11px] text-[var(--text-dim)] font-mono">
            Hit: $0.014 • Miss: $0.44 • Out: $1.32 / 1M
          </div>
        </div>
      </div>

      {/* Main Unified Messages Table */}
      <Card className="border-[var(--border-main)] bg-[var(--bg-card)] overflow-hidden shadow-xl">
        <CardContent className="p-0 overflow-x-auto">
          {messages.length === 0 ? (
            <EmptyState
              title="Sem registros de conversas"
              description="Nenhuma mensagem ou chamada de API foi registrada ainda."
            />
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--bg-card-subtle)] border-b border-[var(--border-main)] text-[var(--text-muted)] font-mono">
                <tr>
                  <th className="p-3.5 px-4 font-bold">{t('type')}</th>
                  <th className="p-3.5 px-4 font-bold">{t('dateTime')}</th>
                  <th className="p-3.5 px-4 font-bold">{t('channel')}</th>
                  <th className="p-3.5 px-4 font-bold">{t('sender')}</th>
                  <th className="p-3.5 px-4 font-bold">Tokens (In / Out)</th>
                  <th className="p-3.5 px-4 font-bold">Custo ({currency})</th>
                  <th className="p-3.5 px-4 font-bold">Execução</th>
                  <th className="p-3.5 px-4 font-bold">{t('message')}</th>
                  <th className="p-3.5 px-4 font-bold text-right">Auditoria</th>
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
                      <td className="p-3.5 px-4 font-mono text-[var(--text-muted)]">{dateStr}</td>
                      <td className="p-3.5 px-4 font-mono text-[var(--text-main)] font-semibold">{m.channel}</td>
                      <td className="p-3.5 px-4 font-semibold text-[var(--text-main)]">{m.senderName}</td>
                      <td className="p-3.5 px-4 font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sky-500 font-bold">
                            {(m.promptTokens || Math.round((m.tokens || 0) * 0.7)).toLocaleString()}{' '}
                            <span className="text-[10px] text-[var(--text-muted)] font-normal">in</span>
                          </span>
                          <span className="text-[var(--text-dim)]">•</span>
                          <span className="text-purple-500 font-bold">
                            {(m.completionTokens || Math.round((m.tokens || 0) * 0.3)).toLocaleString()}{' '}
                            <span className="text-[10px] text-[var(--text-muted)] font-normal">out</span>
                          </span>
                        </div>
                      </td>
                      <td className="p-3.5 px-4 font-mono text-emerald-500 font-bold">
                        {formatCost(m.costUsd, m.costBrl)}
                      </td>
                      <td className="p-3.5 px-4">
                        {subRunsCount > 0 ? (
                          <Badge variant="warning" className="gap-1 text-[10px]">
                            <Layers className="w-3 h-3" />
                            <span>{subRunsCount} passos (tools)</span>
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
                      <td className="p-3.5 px-4 text-right">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 group-hover:text-[var(--accent)]">
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-end transition-opacity">
          <div className="w-full max-w-2xl bg-[var(--bg-card)] h-full border-l border-[var(--border-main)] p-6 flex flex-col justify-between shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
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
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Interaction Summary Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)]">
                  <div className="text-[11px] text-[var(--text-muted)] font-semibold">Custo Consolidado</div>
                  <div className="text-lg font-bold text-emerald-500 font-mono mt-0.5">
                    {formatCost(selectedMessage.costUsd, selectedMessage.costBrl)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)]">
                  <div className="text-[11px] text-sky-500 font-bold">📥 Tokens In</div>
                  <div className="text-base font-bold text-sky-500 font-mono mt-0.5">
                    {(selectedMessage.promptTokens || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)] font-mono">
                    Cache Hit: {selectedMessage.cacheHitRatio || '0%'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)]">
                  <div className="text-[11px] text-purple-500 font-bold">📤 Tokens Out</div>
                  <div className="text-base font-bold text-purple-500 font-mono mt-0.5">
                    {(selectedMessage.completionTokens || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)] font-mono">
                    Total: {(selectedMessage.tokens || 0).toLocaleString()}
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
                    {selectedMessage.subRuns.map((step, idx) => (
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
                          <span className="font-bold text-emerald-500">
                            {formatCost(step.costUsd, step.costBrl)}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-[var(--text-dim)] border-t border-[var(--border-main)] pt-2">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                            <span>{step.latencyMs ? `${step.latencyMs}ms` : '--'}</span>
                          </span>
                          <span className="text-sky-500 font-bold">
                            {(step.promptTokens || 0).toLocaleString()} in
                          </span>
                          <span className="text-purple-500 font-bold">
                            {(step.completionTokens || 0).toLocaleString()} out
                          </span>
                          <span>(Hit: {(step.cacheHitTokens || 0).toLocaleString()})</span>
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
