import React from 'react'
import { useTranslation } from 'react-i18next'
import { Bot, Cpu, Sparkles, ArrowRight } from 'lucide-react'
import { type AgentItem, type DepartmentItem } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface AgentCardProps {
  agent: AgentItem
  department?: DepartmentItem
  onClick: () => void
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, department, onClick }) => {
  const { t } = useTranslation('agents')

  return (
    <Card
      className="group cursor-pointer border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs transition-all hover:border-[var(--accent)]/50 hover:bg-[var(--bg-card-subtle)]"
      onClick={onClick}
    >
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="default" className="max-w-[60%] truncate font-mono text-[10px]">
            {department?.name || agent.department}
          </Badge>
          <div className="flex shrink-0 items-center gap-1">
            {agent.model && (
              <Badge variant="secondary" className="font-mono text-[10px] text-[var(--text-dim)]">
                <Cpu className="mr-1 h-2.5 w-2.5" />
                {agent.model}
              </Badge>
            )}
            {agent.isCustom && (
              <Badge variant="outline" className="border-emerald-500/30 text-[9px] text-emerald-500">
                {t('custom')}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-main)]',
              'bg-[var(--bg-card-subtle)] text-[var(--accent)] transition-colors group-hover:border-[var(--accent)]/40'
            )}
          >
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-[var(--text-main)] group-hover:text-[var(--accent)]">
              {agent.name}
            </h3>
            <p className="line-clamp-1 text-xs text-[var(--text-muted)]">{agent.role}</p>
          </div>
        </div>

        <p className="line-clamp-2 text-xs leading-relaxed text-[var(--text-dim)]">
          {agent.description || agent.role}
        </p>

        <div className="mt-auto space-y-2 border-t border-[var(--border-main)] pt-3">
          <div className="flex flex-wrap gap-1">
            {agent.skills.slice(0, 3).map((sk) => (
              <span
                key={sk}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border-main)] bg-[var(--bg-card-subtle)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-muted)]"
              >
                <Sparkles className="h-2.5 w-2.5 text-[var(--accent)]" />
                {sk}
              </span>
            ))}
            {agent.skills.length > 3 && (
              <span className="rounded-md bg-[var(--bg-card-subtle)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-dim)]">
                +{agent.skills.length - 3}
              </span>
            )}
            {agent.skills.length === 0 && (
              <span className="text-[10px] italic text-[var(--text-dim)]">{t('noSkills')}</span>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-[var(--text-dim)]">
            <span className="font-mono text-[10px]">
              {t('promptTokens', { count: agent.systemPromptTokens || 0 })}
            </span>
            <span className="flex items-center gap-1 font-semibold text-[var(--accent)] transition-transform group-hover:translate-x-0.5">
              {t('inspect')}
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
