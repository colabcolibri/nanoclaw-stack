import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, RefreshCw, Wrench, ChevronRight, X, Clock, Zap, Cpu, DollarSign, CheckCircle2 } from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState<'messages' | 'runs'>('messages')
  const [internalCurrency, setInternalCurrency] = useState<'BRL' | 'USD'>('BRL')
  const currency = parentCurrency || internalCurrency
  const setCurrency = onToggleCurrency || setInternalCurrency
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [runs, setRuns] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [selectedRun, setSelectedRun] = useState<any | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [usageData, runsData] = await Promise.all([
        ApiClient.getUsage(150),
        ApiClient.getRuns(100),
      ])
      setMessages(usageData.logs || [])
      setStats(usageData.stats || null)
      setRuns(runsData.runs || [])
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
          <>
            {/* Tab Selector */}
            <div className="flex p-1 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl gap-1 shadow-xs">
              <Button
                variant={activeTab === 'messages' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-3 font-semibold cursor-pointer"
                onClick={() => setActiveTab('messages')}
              >
                {t('tabMessages')}
              </Button>
              <Button
                variant={activeTab === 'runs' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-3 font-semibold cursor-pointer"
                onClick={() => setActiveTab('runs')}
              >
                {t('tabRuns')}
              </Button>
            </div>

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
          </>
        }
      />

      {/* Metric Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

        <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs">
          <div className="text-xs font-semibold text-[var(--text-muted)]">{t('totalTokens')}</div>
          <div className="text-2xl font-bold text-[var(--text-main)] my-1 font-mono">
            {(stats?.totalTokens ?? stats?.estimatedTokens ?? 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-[var(--text-dim)] font-mono">
            Cache Hit: {stats?.cacheHitRatio || '0%'} • {((stats?.promptTokens || 0)).toLocaleString()} in • {((stats?.completionTokens || 0)).toLocaleString()} out
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs">
          <div className="text-xs font-semibold text-[var(--text-muted)]">{t('totalCalls')}</div>
          <div className="text-2xl font-bold text-[var(--text-main)] my-1 font-mono">
            {stats?.totalApiCalls ?? stats?.totalMessages ?? 0}
          </div>
          <div className="text-[11px] text-[var(--text-dim)] font-mono">
            {stats?.totalRuns || 0} execuções de tools
          </div>
        </div>

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

      {/* Main Table */}
      <Card className="border-[var(--border-main)] bg-[var(--bg-card)] overflow-hidden shadow-xl">
        <CardContent className="p-0 overflow-x-auto">
          {activeTab === 'messages' ? (
            messages.length === 0 ? (
              <EmptyState
                title="Sem registros"
                description={t('noLogs')}
              />
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--bg-card-subtle)] border-b border-[var(--border-main)] text-[var(--text-muted)] font-mono">
                  <tr>
                    <th className="p-3.5 px-4 font-bold">{t('type')}</th>
                    <th className="p-3.5 px-4 font-bold">{t('dateTime')}</th>
                    <th className="p-3.5 px-4 font-bold">{t('channel')}</th>
                    <th className="p-3.5 px-4 font-bold">{t('sender')}</th>
                    <th className="p-3.5 px-4 font-bold">{t('characters')}</th>
                    <th className="p-3.5 px-4 font-bold">Custo ({currency})</th>
                    <th className="p-3.5 px-4 font-bold">{t('message')}</th>
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
                    return (
                      <tr key={m.id} className="hover:bg-[var(--bg-card-subtle)] transition-colors">
                        <td className="p-3.5 px-4">
                          <Badge variant={isUser ? 'default' : 'success'} className="font-mono text-[10px]">
                            {isUser ? 'ENTRADA' : 'RESPOSTA'}
                          </Badge>
                        </td>
                        <td className="p-3.5 px-4 font-mono text-[var(--text-muted)]">{dateStr}</td>
                        <td className="p-3.5 px-4 font-mono text-[var(--text-main)] font-semibold">{m.channel}</td>
                        <td className="p-3.5 px-4 font-semibold text-[var(--text-main)]">{m.senderName}</td>
                        <td className="p-3.5 px-4 font-mono text-[var(--text-muted)]">
                          {(m.charCount || m.text?.length || 0).toLocaleString()}
                        </td>
                        <td className="p-3.5 px-4 font-mono text-emerald-500 font-bold">
                          {formatCost(m.costUsd, m.costBrl)}
                        </td>
                        <td className="p-3.5 px-4 max-w-xs truncate text-[var(--text-main)] font-mono text-[11px]">
                          {m.text}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          ) : (
            runs.length === 0 ? (
              <EmptyState
                title="Sem runs intermediárias"
                description="Nenhuma execução de ferramenta foi registrada até o momento."
              />
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--bg-card-subtle)] border-b border-[var(--border-main)] text-[var(--text-muted)] font-mono">
                  <tr>
                    <th className="p-3.5 px-4 font-bold">{t('stepType')}</th>
                    <th className="p-3.5 px-4 font-bold">{t('dateTime')}</th>
                    <th className="p-3.5 px-4 font-bold">{t('runId')}</th>
                    <th className="p-3.5 px-4 font-bold">Tokens</th>
                    <th className="p-3.5 px-4 font-bold">Custo ({currency})</th>
                    <th className="p-3.5 px-4 font-bold">Detalhes da Tool / Ação</th>
                    <th className="p-3.5 px-4 font-bold text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-main)]">
                  {runs.map((r) => {
                    const dateStr = new Date(r.timestamp).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedRun(r)}
                        className="hover:bg-[var(--bg-card-subtle)] transition-colors cursor-pointer group"
                      >
                        <td className="p-3.5 px-4">
                          <Badge variant={r.type === 'tool_execution' ? 'warning' : 'secondary'} className="font-mono text-[10px]">
                            {r.type === 'tool_execution' ? 'TOOL RUN' : 'MODEL TURN'}
                          </Badge>
                        </td>
                        <td className="p-3.5 px-4 font-mono text-[var(--text-muted)]">{dateStr}</td>
                        <td className="p-3.5 px-4 font-mono text-[var(--text-dim)] text-[10px]">
                          {r.id?.slice(0, 16)}
                        </td>
                        <td className="p-3.5 px-4 font-mono text-[var(--text-main)] font-bold">
                          {(r.tokens || 0).toLocaleString()}
                        </td>
                        <td className="p-3.5 px-4 font-mono text-emerald-500 font-bold">
                          {formatCost(r.costUsd, r.costBrl)}
                        </td>
                        <td className="p-3.5 px-4 max-w-sm truncate text-[var(--text-main)] font-mono text-[11px]">
                          {r.toolName ? (
                            <span className="inline-flex items-center gap-1.5 font-bold text-[var(--accent)]">
                              <Wrench className="w-3.5 h-3.5 text-amber-500" />
                              <span>{r.toolName}</span>
                            </span>
                          ) : (
                            r.preview
                          )}
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
            )
          )}
        </CardContent>
      </Card>

      {/* Interactive Run Inspector Drawer / Modal */}
      {selectedRun && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-end transition-opacity">
          <div className="w-full max-w-lg bg-[var(--bg-card)] h-full border-l border-[var(--border-main)] p-6 flex flex-col justify-between shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-[var(--border-main)] pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-[var(--accent)]" />
                    <h3 className="text-lg font-bold text-[var(--text-main)]">Auditoria da Execução</h3>
                  </div>
                  <p className="text-xs font-mono text-[var(--text-dim)]">{selectedRun.id}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedRun(null)} className="h-8 w-8 p-0 cursor-pointer">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Metric Breakdown Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)]">
                  <div className="text-[11px] text-[var(--text-muted)] font-semibold">Custo em {currency}</div>
                  <div className="text-lg font-bold text-emerald-500 font-mono mt-0.5">
                    {formatCost(selectedRun.costUsd, selectedRun.costBrl)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)]">
                  <div className="text-[11px] text-[var(--text-muted)] font-semibold">Latência da API</div>
                  <div className="text-lg font-bold text-[var(--text-main)] font-mono mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[var(--accent)]" />
                    <span>{selectedRun.latencyMs ? `${selectedRun.latencyMs} ms` : '--'}</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)]">
                  <div className="text-[11px] text-[var(--text-muted)] font-semibold">Tokens Entrada (Prompt)</div>
                  <div className="text-base font-bold text-[var(--text-main)] font-mono mt-0.5">
                    {(selectedRun.promptTokens || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)] font-mono">
                    Hit: {(selectedRun.cacheHitTokens || 0).toLocaleString()} • Miss: {(selectedRun.cacheMissTokens || 0).toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)]">
                  <div className="text-[11px] text-[var(--text-muted)] font-semibold">Tokens Saída (Completion)</div>
                  <div className="text-base font-bold text-[var(--text-main)] font-mono mt-0.5">
                    {(selectedRun.completionTokens || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Tool Execution Details */}
              {selectedRun.toolName && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[var(--text-main)] flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-amber-500" />
                    <span>Ferramenta Invocada</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)] font-mono text-xs text-[var(--accent)] font-bold">
                    {selectedRun.toolName}
                  </div>
                </div>
              )}

              {/* Payload Preview */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-[var(--text-main)]">Conteúdo / Saída</div>
                <pre className="p-4 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)] font-mono text-xs text-[var(--text-main)] whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {selectedRun.rawContent || selectedRun.preview || 'Sem detalhes adicionais'}
                </pre>
              </div>
            </div>

            <Button
              variant="default"
              className="w-full mt-6 font-bold cursor-pointer"
              onClick={() => setSelectedRun(null)}
            >
              Fechar Inspeção
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
