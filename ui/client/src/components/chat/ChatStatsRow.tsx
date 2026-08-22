import React from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, Cpu, DollarSign, Activity } from 'lucide-react'
import { SystemStats } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ChatStatsRowProps {
  stats: SystemStats | null
  currency?: 'BRL' | 'USD'
  className?: string
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toLocaleString('pt-BR')
}

export const ChatStatsRow: React.FC<ChatStatsRowProps> = ({
  stats,
  currency = 'BRL',
  className,
}) => {
  const { t } = useTranslation('chat')
  const exchangeRate = Number(stats?.usdToBrlRate || 5.2)
  const totalTokens = (stats?.promptTokens || 0) + (stats?.completionTokens || 0)

  const items = [
    {
      label: t('statsMessages'),
      value: (stats?.totalMessages || 0).toLocaleString('pt-BR'),
      hint: t('statsMessagesHint', {
        inbound: stats?.totalInbound || 0,
        outbound: stats?.totalOutbound || 0,
      }),
      icon: MessageSquare,
      iconClass: 'text-[var(--accent)]',
    },
    {
      label: t('statsTokens'),
      value: formatCompact(totalTokens),
      hint: t('statsTokensHint', { ratio: stats?.cacheHitRatio || '0%' }),
      icon: Cpu,
      iconClass: 'text-emerald-500',
    },
    {
      label: t('statsCost'),
      value:
        currency === 'BRL'
          ? `R$ ${stats?.estimatedCostBrl || '0,00'}`
          : `$ ${stats?.estimatedCostUsd || '0.00'}`,
      hint:
        currency === 'BRL'
          ? t('statsCostHintBrl', { rate: exchangeRate.toFixed(2) })
          : t('statsCostHintUsd'),
      icon: DollarSign,
      iconClass: 'text-emerald-500',
    },
    {
      label: t('statsHealth'),
      value: stats?.serviceStatus === 'Online' ? t('statsHealthOnline') : stats?.serviceStatus || '—',
      hint: t('statsHealthHint', {
        pid: stats?.servicePid || '--',
        calls: stats?.totalApiCalls || 0,
      }),
      icon: Activity,
      iconClass: stats?.serviceStatus === 'Online' ? 'text-emerald-500' : 'text-[var(--text-dim)]',
    },
  ]

  return (
    <section className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4', className)}>
      {items.map((item) => (
        <Card key={item.label} className="border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {item.label}
              </span>
              <item.icon className={cn('h-4 w-4 shrink-0', item.iconClass)} />
            </div>
            <div className="font-mono text-lg font-semibold tracking-tight text-[var(--text-main)] sm:text-xl">
              {item.value}
            </div>
            <p className="text-[11px] leading-snug text-[var(--text-dim)] font-mono">{item.hint}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
