import React from 'react'
import { MessageSquare, Cpu, DollarSign, Activity } from 'lucide-react'
import { SystemStats } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'

interface StatsGridProps {
  stats: SystemStats | null
  currency?: 'BRL' | 'USD'
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stats, currency = 'BRL' }) => {
  const exchangeRate = Number(stats?.usdToBrlRate || 5.2014)

  const items = [
    {
      label: 'Mensagens',
      value: (stats?.totalMessages || 0).toLocaleString(),
      hint: `${stats?.totalInbound || 0} in • ${stats?.totalOutbound || 0} out`,
      icon: <MessageSquare className="h-4 w-4 text-primary" />,
    },
    {
      label: 'Tokens',
      value: `${(stats?.promptTokens || 0).toLocaleString()} / ${(stats?.completionTokens || 0).toLocaleString()}`,
      hint: `Cache ${stats?.cacheHitRatio || '0%'}`,
      icon: <Cpu className="h-4 w-4 text-emerald-500" />,
    },
    {
      label: currency === 'BRL' ? 'Custo (BRL)' : 'Custo (USD)',
      value:
        currency === 'BRL'
          ? `R$ ${stats?.estimatedCostBrl || '0.00'}`
          : `$ ${stats?.estimatedCostUsd || '0.00'}`,
      hint: currency === 'BRL' ? `R$ ${exchangeRate.toFixed(2)}/USD` : 'API pricing',
      icon: <DollarSign className="h-4 w-4 text-emerald-500" />,
    },
    {
      label: 'Sistema',
      value: stats?.serviceStatus || 'Online',
      hint: `PID ${stats?.servicePid || '--'} • ${stats?.totalApiCalls || 0} calls`,
      icon: <Activity className="h-4 w-4 text-emerald-500" />,
    },
  ]

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between text-xs font-medium text-(--text-muted)">
              <span>{item.label}</span>
              {item.icon}
            </div>
            <div className="text-lg font-semibold tracking-tight text-(--text-main) font-mono sm:text-xl">
              {item.value}
            </div>
            <div className="text-[11px] text-(--text-dim) font-mono">{item.hint}</div>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
