import React from 'react'
import { MessageSquare, Cpu, DollarSign, Activity } from 'lucide-react'
import { SystemStats } from '@/api/client'

interface StatsGridProps {
  stats: SystemStats | null
  currency?: 'BRL' | 'USD'
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stats, currency = 'BRL' }) => {
  const exchangeRate = Number(stats?.usdToBrlRate || 5.2014)

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Messages & Interações */}
      <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] flex flex-col justify-between shadow-xs transition-colors">
        <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)] mb-1">
          <span>Mensagens & Interações</span>
          <MessageSquare className="w-4 h-4 text-[var(--accent)]" />
        </div>
        <div className="text-2xl font-bold text-[var(--text-main)] my-1 font-mono">
          {(stats?.totalMessages || 0).toLocaleString()}
        </div>
        <div className="text-[11px] text-[var(--text-dim)] font-mono">
          {stats?.totalInbound || 0} recebidas • {stats?.totalOutbound || 0} enviadas
        </div>
      </div>

      {/* Real API Tokens (In / Out Separados) */}
      <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] flex flex-col justify-between shadow-xs transition-colors">
        <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)] mb-1">
          <span>Tokens (Entrada / Saída)</span>
          <Cpu className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-lg sm:text-xl font-bold text-[var(--text-main)] my-1 font-mono flex items-center gap-1.5 flex-wrap">
          <span className="text-sky-500 font-bold" title="Tokens de Entrada">
            {(stats?.promptTokens || 0).toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">in</span>
          </span>
          <span className="text-[var(--text-dim)]">•</span>
          <span className="text-purple-500 font-bold" title="Tokens de Saída">
            {(stats?.completionTokens || 0).toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">out</span>
          </span>
        </div>
        <div className="text-[11px] text-[var(--text-dim)] font-mono">
          Total: {(stats?.totalTokens ?? stats?.estimatedTokens ?? 0).toLocaleString()} • Cache Hit: {stats?.cacheHitRatio || '0%'}
        </div>
      </div>

      {/* Real Cost in Selected Currency (BRL or USD) */}
      <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] flex flex-col justify-between shadow-xs transition-colors">
        <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)] mb-1">
          <span>{currency === 'BRL' ? 'Custo Total (BRL)' : 'Custo Total (USD)'}</span>
          <DollarSign className="w-4 h-4 text-emerald-500" />
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

      {/* Service Status */}
      <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] flex flex-col justify-between shadow-xs transition-colors">
        <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)] mb-1">
          <span>Status do Sistema</span>
          <Activity className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-lg font-bold text-emerald-500 my-1 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>{stats?.serviceStatus || 'Online'}</span>
        </div>
        <div className="text-[11px] text-[var(--text-dim)] font-mono">
          PID: {stats?.servicePid || '--'} • {stats?.totalApiCalls || 0} chamadas API
        </div>
      </div>
    </section>
  )
}
