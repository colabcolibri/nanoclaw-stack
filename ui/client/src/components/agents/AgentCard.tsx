import React from 'react'
import { useTranslation } from 'react-i18next'
import { MoreVertical, Cpu } from 'lucide-react'
import { type AgentItem, type DepartmentItem, type SkillItem } from '@/api/client'
import {
  formatTokenCount,
  getAgentContextTokens,
  getAgentIcon,
  getAgentSkillStats,
  getDepartmentIcon,
} from '@/components/agents/agent-utils'
import { cn } from '@/lib/utils'

interface AgentCardProps {
  agent: AgentItem
  department?: DepartmentItem
  skills: SkillItem[]
  isSelected?: boolean
  usagePercent: number
  onClick: () => void
  onMenuClick?: (e: React.MouseEvent) => void
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  department,
  skills,
  isSelected,
  usagePercent,
  onClick,
  onMenuClick,
}) => {
  const { t } = useTranslation('agents')
  const AgentIcon = getAgentIcon(agent)
  const DeptIcon = getDepartmentIcon(agent.department)
  const { active, total } = getAgentSkillStats(agent, skills)
  const contextTokens = getAgentContextTokens(agent, skills)
  const isOffline = agent.skills.length === 0 && !agent.systemPrompt?.trim()

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'group relative min-w-0 cursor-pointer overflow-hidden rounded-xl border p-6 transition-all',
        'bg-[var(--bg-card)]',
        isSelected
          ? 'border-[var(--accent-border)] shadow-[0_0_15px_rgba(56,189,248,0.08)] ring-1 ring-[var(--accent-border)]'
          : 'border-[var(--border-main)] hover:border-[var(--border-main)]/80 hover:bg-[var(--bg-card-subtle)]',
        isOffline && 'opacity-75'
      )}
    >
      {isSelected && (
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[var(--accent)]/5 blur-2xl" />
      )}

      <div className="mb-5 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-main)] bg-[var(--bg-card-subtle)]">
            <AgentIcon className="h-5 w-5 text-[var(--accent)]" />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  isOffline ? 'border border-[var(--text-dim)] bg-[var(--bg-card-subtle)]' : 'bg-[var(--success)]'
                )}
              />
              <span
                className={cn(
                  'text-xs font-medium',
                  isOffline ? 'text-[var(--text-dim)]' : 'text-[var(--success)]'
                )}
              >
                {isOffline ? t('statusOffline') : t('statusOnline')}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onMenuClick?.(e)
              }}
              className="rounded-lg p-1 text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-card-subtle)] hover:text-[var(--text-main)]"
              aria-label={t('inspect')}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>

        <h3 className="text-base font-semibold leading-snug text-[var(--text-main)] break-words">
          {agent.name}
        </h3>

        {agent.role && (
          <p className="text-xs leading-relaxed text-[var(--text-muted)] break-words">{agent.role}</p>
        )}
      </div>

      <div className="space-y-0">
        <div className="flex min-w-0 items-center justify-start gap-1.5 border-b border-[var(--border-main)]/50 py-2">
          <DeptIcon className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <span className="min-w-0 text-sm leading-snug text-[var(--text-main)] break-words">
            {department?.name || agent.department}
          </span>
        </div>

        <div className="flex min-w-0 items-center justify-between gap-2 border-b border-[var(--border-main)]/50 py-2">
          <span className="flex shrink-0 items-center gap-1.5 text-sm text-[var(--text-muted)]">
            <Cpu className="h-3.5 w-3.5" />
            {t('cardModel')}
          </span>
          <span className="min-w-0 break-all text-right font-mono text-xs text-[var(--text-main)]">
            {agent.model || t('modelDefault')}
          </span>
        </div>

        <div className="flex min-w-0 items-center justify-between gap-2 border-b border-[var(--border-main)]/50 py-2">
          <span className="shrink-0 text-sm text-[var(--text-muted)]">{t('cardActiveSkills')}</span>
          <span className="rounded bg-[var(--bg-card-subtle)] px-2 py-0.5 font-mono text-xs text-[var(--text-main)]">
            {active}/{total}
          </span>
        </div>

        <div className="flex min-w-0 items-center justify-between gap-2 py-2">
          <span className="shrink-0 text-sm text-[var(--text-muted)]">{t('cardContextLoad')}</span>
          <span
            className={cn(
              'min-w-0 break-all text-right font-mono text-xs',
              isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-main)]'
            )}
          >
            {formatTokenCount(contextTokens)} {t('tokensUnit')}
          </span>
        </div>
      </div>

      <div className="mt-6 h-1 overflow-hidden rounded-full bg-[var(--bg-card-subtle)]">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isSelected ? 'bg-[var(--accent)]' : 'bg-[var(--text-muted)]'
          )}
          style={{ width: `${Math.max(4, usagePercent)}%` }}
        />
      </div>
    </article>
  )
}
