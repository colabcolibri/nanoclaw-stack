import React from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, Cpu, DollarSign, Activity } from 'lucide-react'
import { SystemStats } from '@/api/client'

interface StatsGridProps {
  stats: SystemStats | null
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stats }) => {
  const { t } = useTranslation('common')

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Messages */}
      <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] flex flex-col justify-between shadow-sm transition-colors">
        <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)] mb-1">
          <span>{t('stats.totalMessages')}</span>
          <MessageSquare className="w-4 h-4 text-[var(--accent)]" />
        </div>
        <div className="text-2xl font-bold text-[var(--text-main)] my-1 font-mono">
          {(stats?.totalMessages || 0).toLocaleString()}
        </div>
        <div className="text-[11px] text-[var(--text-dim)]">
          {t('stats.messagesSub', {
            inbound: stats?.totalInbound || 0,
            outbound: stats?.totalOutbound || 0,
          })}
        </div>
      </div>

      {/* Tokens */}
      <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] flex flex-col justify-between shadow-sm transition-colors">
        <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)] mb-1">
          <span>{t('stats.estimatedTokens')}</span>
          <Cpu className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-2xl font-bold text-[var(--text-main)] my-1 font-mono">
          {(stats?.estimatedTokens || 0).toLocaleString()}
        </div>
        <div className="text-[11px] text-[var(--text-dim)] font-mono">
          {t('stats.tokensSub')}
        </div>
      </div>

      {/* Cost */}
      <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] flex flex-col justify-between shadow-sm transition-colors">
        <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)] mb-1">
          <span>{t('stats.estimatedCost')}</span>
          <DollarSign className="w-4 h-4 text-amber-500" />
        </div>
        <div className="text-2xl font-bold text-[var(--accent)] my-1 font-mono">
          ${stats?.estimatedCostUsd || '0.00'}
        </div>
        <div className="text-[11px] text-[var(--text-dim)]">
          {t('stats.costSub')}
        </div>
      </div>

      {/* Service Status */}
      <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] flex flex-col justify-between shadow-sm transition-colors">
        <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)] mb-1">
          <span>{t('stats.serviceStatus')}</span>
          <Activity className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-lg font-bold text-emerald-500 my-1 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>{stats?.serviceStatus || 'Online'}</span>
        </div>
        <div className="text-[11px] text-[var(--text-dim)] font-mono">
          {t('stats.servicePid', { pid: stats?.servicePid || '--' })}
        </div>
      </div>
    </section>
  )
}
