import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, RefreshCw } from 'lucide-react'
import { useDefaultGroup } from '@/contexts/AppConfigContext'
import { ApiClient, type SkillItem, type AgentItem } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchInput } from '@/components/common/SearchInput'
import { EmptyState } from '@/components/common/EmptyState'
import { SkillCard } from '@/components/skills/SkillCard'
import { SkillDetailsDrawer } from '@/components/skills/SkillDetailsDrawer'
import {
  enrichSkillsWithAgents,
  filterSkills,
  countUnassignedSkills,
  type SkillScopeFilter,
} from '@/components/skills/skill-utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export const SkillsView: React.FC = () => {
  const group = useDefaultGroup()
  const { t } = useTranslation('skills')
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [agents, setAgents] = useState<AgentItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [scopeFilter, setScopeFilter] = useState<SkillScopeFilter>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [skillsData, agentsData] = await Promise.all([
        ApiClient.getSkills(group),
        ApiClient.getDepartmentsAndAgents(group).catch(() => ({ agents: [], departments: [] })),
      ])
      const agentList = agentsData.agents || []
      setAgents(agentList)
      setSkills(enrichSkillsWithAgents(skillsData.skills || [], agentList))
    } catch {
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [group])

  const filteredSkills = useMemo(
    () => filterSkills(skills, agents, searchQuery, scopeFilter),
    [skills, agents, searchQuery, scopeFilter]
  )

  const globalCount = skills.filter((s) => s.isGlobal).length
  const specializedCount = skills.length - globalCount
  const unassignedCount = countUnassignedSkills(skills, agents)

  const scopeChips: { id: SkillScopeFilter; label: string }[] = [
    { id: 'all', label: t('filterAll') },
    { id: 'global', label: t('filterGlobal') },
    { id: 'specialized', label: t('filterSpecialized') },
    { id: 'unassigned', label: t('filterUnassigned') },
  ]

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-5">
      <PageHeader
        view="skills"
        subtitle={t('subtitle')}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            {t('refresh', { ns: 'common' })}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)
        ) : (
          <>
            <StatCard label={t('statsTotal')} value={skills.length} />
            <StatCard label={t('statsGlobal')} value={globalCount} />
            <StatCard label={t('statsSpecialized')} value={specializedCount} />
            <StatCard label={t('statsUnassigned')} value={unassignedCount} />
            <StatCard label={t('statsAgents')} value={agents.length} />
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {scopeChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setScopeFilter(chip.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                scopeFilter === chip.id
                  ? 'border-(--accent-border) bg-(--accent-subtle) text-(--accent)'
                  : 'border-(--border-main) bg-(--bg-card) text-(--text-muted) hover:text-(--text-main)'
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('searchPlaceholder')}
          className="w-full sm:max-w-sm"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[220px] rounded-xl" />
          ))}
        </div>
      ) : filteredSkills.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-8 w-8 text-(--text-dim)" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredSkills.map((skill) => (
            <SkillCard
              key={skill.name}
              skill={skill}
              agents={agents}
              onClick={() => {
                setSelectedSkill(skill)
                setIsDrawerOpen(true)
              }}
            />
          ))}
        </div>
      )}

      <SkillDetailsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        skill={selectedSkill}
      />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-xl border border-(--border-main) bg-(--bg-card) p-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-(--text-dim)">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-(--text-main)">{value}</p>
    </div>
  )
}
