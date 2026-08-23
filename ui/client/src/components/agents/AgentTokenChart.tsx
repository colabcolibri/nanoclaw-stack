import React from 'react'
import { useTranslation } from 'react-i18next'
import { formatTokenCount } from '@/components/agents/agent-utils'

interface AgentTokenChartProps {
  bars: { day: string; value: number }[]
  max: number
  total: number
  highlightDay?: string
}

export const AgentTokenChart: React.FC<AgentTokenChartProps> = ({
  bars,
  max,
  total,
  highlightDay,
}) => {
  const { t } = useTranslation('agents')

  return (
    <section className="min-w-0 max-w-full overflow-hidden">
      <div className="mb-4 flex min-w-0 items-end justify-between gap-3">
        <h3 className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-(--text-main)">
          {t('tokenChartTitle')}
        </h3>
        <span className="font-mono text-xs text-(--accent)">
          {t('tokenChartTotal', { count: formatTokenCount(total) })}
        </span>
      </div>

      <div className="flex h-48 min-w-0 items-end justify-between gap-1 overflow-hidden rounded-xl border border-(--border-main) bg-(--bg-card-subtle)/50 p-3 sm:gap-2 sm:p-5">
        {bars.map((bar) => {
          const height = Math.max(8, Math.round((bar.value / max) * 100))
          const isHighlight = bar.day === highlightDay

          return (
            <div key={bar.day} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <div className="relative flex w-full flex-col items-center justify-end" style={{ height: '120px' }}>
                {isHighlight && (
                  <div className="absolute -top-6 rounded border border-(--border-main) bg-(--bg-card) px-1.5 py-0.5 font-mono text-[10px] text-(--text-main) opacity-0 transition-opacity group-hover:opacity-100">
                    {formatTokenCount(bar.value)}
                  </div>
                )}
                <div
                  className={`w-full rounded-t-sm transition-colors ${
                    isHighlight
                      ? 'border-t border-(--accent) bg-(--accent)/80'
                      : 'bg-(--bg-card-subtle) group-hover:bg-(--accent)/40'
                  }`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span
                className={`text-[10px] ${
                  isHighlight
                    ? 'font-bold text-(--accent)'
                    : 'text-(--text-dim)'
                }`}
              >
                {bar.day}
              </span>
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-[10px] text-(--text-dim)">{t('tokenChartHint')}</p>
    </section>
  )
}
