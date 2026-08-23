import React from 'react'
import { useTranslation } from 'react-i18next'
import { type DepartmentItem } from '@/api/client'
import { buildAgentYamlPreview } from '@/components/agents/agent-utils'
import { AgentYamlPreview } from '@/components/agents/AgentYamlPreview'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ModelSelect } from '@/components/common/ModelSelect'
import { type ProviderMeta } from '@/lib/model-registry'

export interface AgentConfigFormState {
  id: string
  name: string
  department: string
  role: string
  description: string
  model: string
  allowGlobalSkills: boolean
  skills: string[]
}

interface AgentConfigFormProps {
  form: AgentConfigFormState
  departments: DepartmentItem[]
  providers: Record<string, ProviderMeta>
  groupWorkerModel?: string
  onChange: (patch: Partial<AgentConfigFormState>) => void
}

export const AgentConfigForm: React.FC<AgentConfigFormProps> = ({
  form,
  departments,
  providers,
  groupWorkerModel,
  onChange,
}) => {
  const { t } = useTranslation('agents')

  const yamlPreview = buildAgentYamlPreview({
    id: form.id,
    name: form.name,
    department: form.department,
    role: form.role,
    description: form.description,
    skills: form.skills,
    allowGlobalSkills: form.allowGlobalSkills,
    model: form.model,
  })

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('displayName')}</Label>
          <Input
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="text-xs"
          />
        </div>

        <div className="space-y-2">
          <Label>{t('agentSlug')}</Label>
          <Input value={form.id} disabled className="font-mono text-xs text-(--text-dim)" />
        </div>

        <div className="space-y-2">
          <Label>{t('department')}</Label>
          <Select value={form.department} onValueChange={(v) => onChange({ department: v })}>
            <SelectTrigger className="text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>{t('dedicatedModel')}</Label>
          <ModelSelect
            providers={providers}
            value={form.model}
            onChange={(v) => onChange({ model: v })}
            allowDefault
            defaultLabel={
              groupWorkerModel
                ? `${t('modelWorkerDefault')} → ${groupWorkerModel}`
                : t('modelWorkerDefault')
            }
            className="w-full rounded-lg border border-(--border-main) bg-(--bg-input) px-3 py-2 font-mono text-xs text-(--text-main)"
          />
          <p className="text-[11px] leading-relaxed text-(--text-dim)">{t('dedicatedModelHint')}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('role')}</Label>
        <Input value={form.role} onChange={(e) => onChange({ role: e.target.value })} className="text-xs" />
      </div>

      <div className="space-y-2">
        <Label>{t('description')}</Label>
        <textarea
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
          className="w-full rounded-lg border border-(--border-main) bg-(--bg-input) px-3 py-2 text-xs text-(--text-main) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-(--border-main) bg-(--bg-card-subtle) p-3.5">
        <input
          type="checkbox"
          checked={form.allowGlobalSkills}
          onChange={(e) => onChange({ allowGlobalSkills: e.target.checked })}
          className="mt-0.5 h-4 w-4 rounded"
        />
        <span className="text-xs text-(--text-main)">
          <span className="block font-semibold">{t('allowGlobalSkills')}</span>
          <span className="text-[11px] text-(--text-muted)">{t('allowGlobalSkillsHint')}</span>
        </span>
      </label>

      <AgentYamlPreview yaml={yamlPreview} />
    </div>
  )
}
