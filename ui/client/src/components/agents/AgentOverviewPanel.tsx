import React from 'react'
import { useTranslation } from 'react-i18next'
import { Cpu, FileText, FolderOpen, Sparkles } from 'lucide-react'
import { type AgentItem, type DepartmentItem, type SkillItem } from '@/api/client'
import {
  formatTokenCount,
  getAgentFileLabel,
  getDepartmentIcon,
  normalizeSkillName,
} from '@/components/agents/agent-utils'
import { AgentYamlPreview } from '@/components/agents/AgentYamlPreview'
import { Badge } from '@/components/ui/badge'

interface AgentOverviewPanelProps {
  agent: AgentItem
  department?: DepartmentItem
  assignedSkills: SkillItem[]
  promptChars: number
  promptTokens: number
}

export const AgentOverviewPanel: React.FC<AgentOverviewPanelProps> = ({
  agent,
  department,
  assignedSkills,
  promptChars,
  promptTokens,
}) => {
  const { t } = useTranslation('agents')
  const DeptIcon = getDepartmentIcon(agent.department)
  const fileLabel = getAgentFileLabel(agent.filePath, agent.id)

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--border-main)]/50 bg-[var(--bg-card-subtle)]/30 p-4">
          <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
            <Cpu className="h-3.5 w-3.5" />
            {t('baseModel')}
          </span>
          <p className="font-mono text-sm text-[var(--text-main)] break-words">
            {agent.model || t('modelDefault')}
          </p>
        </div>

        <div className="rounded-lg border border-[var(--border-main)]/50 bg-[var(--bg-card-subtle)]/30 p-4">
          <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
            <DeptIcon className="h-3.5 w-3.5" />
            {t('department')}
          </span>
          <p className="text-sm leading-snug text-[var(--text-main)] break-words">
            {department?.name || agent.department}
          </p>
        </div>

        <div className="rounded-lg border border-[var(--border-main)]/50 bg-[var(--bg-card-subtle)]/30 p-4">
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
            {t('role')}
          </span>
          <p className="text-sm leading-snug text-[var(--text-main)] break-words">{agent.role}</p>
        </div>

        <div className="rounded-lg border border-[var(--border-main)]/50 bg-[var(--bg-card-subtle)]/30 p-4">
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
            {t('agentOrigin')}
          </span>
          <Badge variant={agent.isCustom ? 'outline' : 'secondary'} className="text-[10px]">
            {agent.isCustom ? t('originCustom') : t('originBuiltin')}
          </Badge>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border-main)]/50 bg-[var(--bg-card-subtle)]/20 p-4">
        <div className="mb-2 flex items-center gap-2">
          <FolderOpen className="h-3.5 w-3.5 text-[var(--accent)]" />
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {t('agentFile')}
          </p>
        </div>
        <p className="font-mono text-xs text-[var(--text-main)] break-all">{fileLabel}</p>
        {agent.filePath && (
          <p className="mt-1 font-mono text-[10px] text-[var(--text-dim)] break-all">{agent.filePath}</p>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-main)]">
          {t('operationalDescription')}
        </h3>
        <p className="text-sm leading-relaxed text-[var(--text-muted)] break-words">
          {agent.description || agent.role || t('drawerRoleFallback')}
        </p>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-main)]">
            {t('assignedSkills')}
          </h3>
          <span className="font-mono text-[10px] text-[var(--text-dim)]">
            {assignedSkills.length} {t('skillsCount')}
          </span>
        </div>
        {assignedSkills.length === 0 ? (
          <p className="text-xs italic text-[var(--text-dim)]">{t('noAssignedSkills')}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {assignedSkills.map((sk) => (
              <Badge key={sk.name} variant="secondary" className="font-mono text-[10px]">
                <Sparkles className="mr-1 h-2.5 w-2.5" />
                {sk.name}
              </Badge>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-[var(--text-dim)]">
          {t('allowGlobalSkills')}: {agent.allowGlobalSkills !== false ? t('yes') : t('no')}
        </p>
      </section>

      {agent.rawYaml && <AgentYamlPreview yaml={agent.rawYaml} />}

      <section className="rounded-lg border border-[var(--border-main)]/50 bg-[var(--bg-card-subtle)]/20 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-[var(--accent)]" />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {t('promptBody')}
            </p>
          </div>
          <div className="flex gap-1.5">
            <Badge variant="secondary" className="font-mono text-[10px]">
              {t('chars', { count: promptChars })}
            </Badge>
            <Badge variant="default" className="font-mono text-[10px]">
              {t('tokens', { count: promptTokens })}
            </Badge>
          </div>
        </div>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[var(--text-muted)]">
          {agent.systemPrompt?.trim() || t('emptyPrompt')}
        </pre>
      </section>
    </div>
  )
}

export function filterAssignedSkills(agent: AgentItem, availableSkills: SkillItem[]): SkillItem[] {
  const selectedNorm = new Set((agent.skills || []).map(normalizeSkillName))
  return availableSkills.filter(
    (s) =>
      agent.skills.includes(s.name) ||
      selectedNorm.has(normalizeSkillName(s.name))
  )
}
