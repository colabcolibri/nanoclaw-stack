import React from 'react'
import { useTranslation } from 'react-i18next'
import { Bot, Folder, Globe, Sparkles } from 'lucide-react'
import { type AgentItem, type SkillItem } from '@/api/client'
import { getAgentsUsingSkill, formatSkillTokens } from '@/components/skills/skill-utils'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/templates/StatusBadge'
import { SkillBadge } from '@/components/templates/SkillBadge'
import { cn } from '@/lib/utils'

interface SkillCardProps {
  skill: SkillItem
  agents: AgentItem[]
  onClick: () => void
}

export const SkillCard: React.FC<SkillCardProps> = ({ skill, agents, onClick }) => {
  const { t } = useTranslation('skills')
  const usingAgents = getAgentsUsingSkill(skill, agents)
  const refCount = skill.references?.length || 0
  const scriptCount = skill.scripts?.length || 0

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
        'flex min-w-0 cursor-pointer flex-col rounded-xl border border-(--border-main) bg-(--bg-card) p-5 transition-colors',
        'hover:border-(--accent-border) hover:bg-(--bg-card-subtle)/40'
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="wrap-break-word font-mono text-sm font-semibold leading-snug text-(--text-main)">
              {skill.name}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-(--text-muted)">
              {skill.description || t('noDescription')}
            </p>
          </div>
        </div>
        {skill.isGlobal ? (
          <StatusBadge className="shrink-0 gap-1 text-[10px]">
            <Globe className="h-3 w-3" />
            <span>{t('badgeGlobal')}</span>
          </StatusBadge>
        ) : (
          <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
            <Bot className="h-3 w-3" />
            <span>{t('badgeSpecialized')}</span>
          </Badge>
        )}
      </div>

      <div className="mb-3 border-t border-(--border-main)/60 pt-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-(--text-dim)">
          {t('usedBy')}
        </p>
        {usingAgents.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {usingAgents.map((agent) => (
              <Badge
                key={agent.id}
                variant="outline"
                className="max-w-full text-[10px] font-medium"
              >
                <span className="truncate">{agent.name}</span>
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs italic text-(--text-dim)">{t('noAgents')}</span>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 text-[10px] text-(--text-dim)">
        <span className="font-mono font-semibold text-(--text-main)">
          ~{formatSkillTokens(skill.totalTokens || 0)} {t('tokens')}
        </span>
        {refCount > 0 && (
          <SkillBadge kind="ref" className="gap-1 px-1.5 py-0 text-[9px] font-mono">
            <Folder className="h-2.5 w-2.5" />
            {refCount} {t('refs')}
          </SkillBadge>
        )}
        {scriptCount > 0 && (
          <span className="font-mono">
            {scriptCount} {t('scripts')}
          </span>
        )}
        {!skill.enabled && (
          <Badge variant="destructive" className="text-[9px]">
            {t('disabled')}
          </Badge>
        )}
      </div>
    </article>
  )
}
