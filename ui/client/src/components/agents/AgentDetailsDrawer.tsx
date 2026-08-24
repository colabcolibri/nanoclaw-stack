import React, { useState, useEffect, useMemo } from 'react'
import { useDefaultGroup } from '@/contexts/AppConfigContext'
import { useTranslation } from 'react-i18next'
import { Sparkles, Check, Save, Trash2, Pencil, Cpu } from 'lucide-react'
import { type AgentItem, type DepartmentItem, type SkillItem, ApiClient } from '@/api/client'
import { getAgentIcon, normalizeSkillName, formatAgentModelLabel } from '@/components/agents/agent-utils'
import { AgentOverviewPanel } from '@/components/agents/AgentOverviewPanel'
import { AgentConfigForm } from '@/components/agents/AgentConfigForm'
import type { InferenceParamsForm } from '@/components/config/RoleInferenceParamsForm'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  SheetTemplate,
  SheetTemplateFooter,
} from '@/components/templates/SheetTemplate'
import {
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useLlmRegistry } from '@/hooks/useLlmRegistry'

interface AgentDetailsDrawerProps {
  isOpen: boolean
  onClose: () => void
  agent: AgentItem | null
  departments: DepartmentItem[]
  availableSkills: SkillItem[]
  groupWorkerModel?: string
  onAgentSaved: (updated: AgentItem) => void
  onAgentDeleted?: (agentId: string) => void
}

export const AgentDetailsDrawer: React.FC<AgentDetailsDrawerProps> = ({
  isOpen,
  onClose,
  agent,
  departments,
  availableSkills,
  groupWorkerModel,
  onAgentSaved,
  onAgentDeleted,
}) => {
  const group = useDefaultGroup()
  const { t } = useTranslation('agents')
  const { providers } = useLlmRegistry()
  const [activeTab, setActiveTab] = useState('overview')
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [role, setRole] = useState('')
  const [description, setDescription] = useState('')
  const [model, setModel] = useState('')
  const [inferenceParams, setInferenceParams] = useState<InferenceParamsForm | undefined>(undefined)
  const [allowGlobalSkills, setAllowGlobalSkills] = useState(true)
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [systemPrompt, setSystemPrompt] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (agent) {
      setName(agent.name || '')
      setDepartment(agent.department || 'productivity')
      setRole(agent.role || '')
      setDescription(agent.description || '')
      setModel(agent.model?.trim() || '')
      setInferenceParams(
        agent.inferenceParams && Object.keys(agent.inferenceParams).length > 0
          ? { ...agent.inferenceParams }
          : undefined,
      )
      setAllowGlobalSkills(agent.allowGlobalSkills !== false)
      setSelectedSkills(agent.skills || [])
      setSystemPrompt(agent.systemPrompt || '')
      setSaveSuccess(false)
      setActiveTab('overview')
    }
  }, [agent])

  const configForm = useMemo(
    () => ({
      id: agent?.id || '',
      name,
      department,
      role,
      description,
      model,
      inferenceParams,
      allowGlobalSkills,
      skills: selectedSkills,
    }),
    [
      agent?.id,
      name,
      department,
      role,
      description,
      model,
      inferenceParams,
      allowGlobalSkills,
      selectedSkills,
    ],
  )

  if (!agent) return null

  const AgentIcon = getAgentIcon(agent)
  const deptObj = departments.find((d) => d.id === department)
  const promptChars = systemPrompt.length
  const promptTokens = Math.ceil(promptChars / 3.8)

  const selectedNorm = new Set(selectedSkills.map(normalizeSkillName))
  const isSkillSelected = (skillName: string) =>
    selectedSkills.includes(skillName) || selectedNorm.has(normalizeSkillName(skillName))
  const assignedSkillObjects = availableSkills.filter((s) => isSkillSelected(s.name))

  const overviewAgent: AgentItem = {
    ...agent,
    name,
    department,
    role,
    description,
    model,
    inferenceParams,
    allowGlobalSkills,
    skills: selectedSkills,
    systemPrompt,
    systemPromptChars: promptChars,
    systemPromptTokens: promptTokens,
  }

  const handleToggleSkill = (skillName: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillName) ? prev.filter((s) => s !== skillName) : [...prev, skillName]
    )
  }

  const modelLabels = {
    inherited: t('modelInherited'),
    unresolved: t('modelDefault'),
  }
  const modelDisplay = formatAgentModelLabel(overviewAgent, groupWorkerModel, modelLabels)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await ApiClient.saveAgent(group, agent.id, {
        name,
        department,
        role,
        description,
        model: model.trim() || undefined,
        inferenceParams:
          inferenceParams && Object.keys(inferenceParams).length > 0 ? inferenceParams : undefined,
        allowGlobalSkills,
        skills: selectedSkills,
        systemPrompt,
      })
      if (res.success && res.agent) {
        onAgentSaved(res.agent)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2500)
      }
    } catch (err) {
      console.error('Erro ao salvar agente:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(t('deleteConfirm', { name: agent.name }))) return
    try {
      const res = await ApiClient.deleteAgent(group, agent.id)
      if (res.success) {
        onAgentDeleted?.(agent.id)
        onClose()
      }
    } catch (err) {
      console.error('Erro ao excluir agente:', err)
    }
  }

  return (
    <SheetTemplate
      open={isOpen}
      onClose={onClose}
      size="3xl"
      bodyScrollable={false}
      header={
        <SheetHeader className="space-y-0 border-b border-(--border-main) bg-(--bg-card-subtle)/50 px-6 pb-5 pt-6">
          <div className="flex items-start gap-4 pr-8">
            <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-(--accent-border) bg-(--accent-subtle)">
              <AgentIcon className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="mb-1 flex flex-wrap items-center gap-2 text-xl">
                <span className="wrap-break-word leading-snug">{name || agent.id}</span>
                <Badge
                  variant="outline"
                  className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-500"
                >
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {t('drawerActive')}
                </Badge>
              </SheetTitle>
              <SheetDescription asChild>
                <div className="space-y-1">
                  <p className="font-mono text-xs text-(--text-dim) break-all">ID: {agent.id}</p>
                  <p className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-primary">
                    <Cpu className="h-3 w-3 shrink-0" />
                    <span className="break-all">{modelDisplay}</span>
                  </p>
                </div>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
      }
      footer={
        activeTab !== 'overview' ? (
          <SheetTemplateFooter>
            {saveSuccess ? (
              <Button variant="default" size="sm" disabled className="text-xs">
                <Check className="mr-1 h-3.5 w-3.5" />
                {t('saved')}
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
                  {t('cancel')}
                </Button>
                <Button variant="default" size="sm" onClick={handleSave} disabled={isSaving} className="text-xs">
                  <Save className="mr-1 h-3.5 w-3.5" />
                  {isSaving ? t('saving') : t('save')}
                </Button>
              </>
            )}
          </SheetTemplateFooter>
        ) : undefined
      }
    >
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="shrink-0 border-b border-(--border-main) px-4 sm:px-6">
              <div className="overflow-x-auto overflow-y-hidden">
                <TabsList className="inline-flex h-auto w-max min-w-full justify-start gap-5 rounded-none border-0 bg-transparent p-0 shadow-none">
                <TabsTrigger
                  value="overview"
                  className="mb-0 shrink-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 py-3 text-xs font-semibold uppercase tracking-wide shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=inactive]:text-(--text-muted) data-[state=inactive]:hover:text-(--text-main)"
                >
                  {t('drawerOverview')}
                </TabsTrigger>
                <TabsTrigger
                  value="config"
                  className="mb-0 shrink-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 py-3 text-xs font-semibold uppercase tracking-wide shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=inactive]:text-(--text-muted) data-[state=inactive]:hover:text-(--text-main)"
                >
                  {t('drawerConfig')}
                </TabsTrigger>
                <TabsTrigger
                  value="skills"
                  className="mb-0 shrink-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 py-3 text-xs font-semibold uppercase tracking-wide shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=inactive]:text-(--text-muted) data-[state=inactive]:hover:text-(--text-main)"
                >
                  {t('drawerSkills')}
                </TabsTrigger>
                <TabsTrigger
                  value="prompt"
                  className="mb-0 shrink-0 rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 py-3 text-xs font-semibold uppercase tracking-wide shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=inactive]:text-(--text-muted) data-[state=inactive]:hover:text-(--text-main)"
                >
                  {t('drawerPrompt')}
                </TabsTrigger>
              </TabsList>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6">
              <TabsContent value="overview" className="mt-0">
                <AgentOverviewPanel
                  agent={overviewAgent}
                  department={deptObj}
                  assignedSkills={assignedSkillObjects}
                  promptChars={promptChars}
                  promptTokens={promptTokens}
                  groupWorkerModel={groupWorkerModel}
                />
                <div className="mt-6 flex flex-wrap gap-3 border-t border-(--border-main)/50 pt-4">
                  {agent.isCustom && (
                    <Button variant="outline" className="text-xs" onClick={handleDelete}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      {t('delete')}
                    </Button>
                  )}
                  <Button variant="default" className="text-xs" onClick={() => setActiveTab('config')}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    {t('editConfig')}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="config" className="mt-0">
                <AgentConfigForm
                  form={configForm}
                  departments={departments}
                  providers={providers}
                  groupWorkerModel={groupWorkerModel}
                  onChange={(patch) => {
                    if (patch.name !== undefined) setName(patch.name)
                    if (patch.department !== undefined) setDepartment(patch.department)
                    if (patch.role !== undefined) setRole(patch.role)
                    if (patch.description !== undefined) setDescription(patch.description)
                    if (patch.model !== undefined) setModel(patch.model)
                    if ('inferenceParams' in patch) setInferenceParams(patch.inferenceParams)
                    if (patch.allowGlobalSkills !== undefined) setAllowGlobalSkills(patch.allowGlobalSkills)
                  }}
                />
              </TabsContent>

              <TabsContent value="skills" className="mt-0 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-(--text-muted)">{t('assignedSkills')}</p>
                  <span className="font-mono text-[11px] font-semibold text-primary">
                    {t('skillsSelected', { count: selectedSkills.length })}
                  </span>
                </div>

                <div className="grid max-h-[min(50vh,24rem)] grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-(--border-main) bg-(--bg-card-subtle) p-2">
                  {availableSkills
                    .filter((sk) => !sk.isGlobal)
                    .map((sk) => {
                      const isChecked = isSkillSelected(sk.name)
                      return (
                        <button
                          key={sk.name}
                          type="button"
                          onClick={() => handleToggleSkill(sk.name)}
                          className={`flex min-w-0 items-center gap-2.5 rounded-lg border p-2.5 text-left text-xs transition-all ${
                            isChecked
                              ? 'border-(--accent-border) bg-(--accent-subtle) font-medium text-primary'
                              : 'border-transparent text-(--text-muted) hover:bg-(--bg-card)'
                          }`}
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              isChecked
                                ? 'border-primary bg-primary text-white'
                                : 'border-(--border-main)'
                            }`}
                          >
                            {isChecked && <Check className="h-3 w-3" />}
                          </span>
                          <span className="min-w-0 break-all font-mono">{sk.name}</span>
                        </button>
                      )
                    })}
                </div>

                {assignedSkillObjects.length > 0 && (
                  <div className="space-y-3">
                    {assignedSkillObjects.map((sk) => (
                      <div
                        key={sk.name}
                        className="rounded-xl border border-(--border-main) bg-(--bg-card-subtle) p-4"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                            <span className="break-all font-mono text-xs font-bold">{sk.name}</span>
                          </div>
                          <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                            ~{sk.totalTokens || 0} tok
                          </Badge>
                        </div>
                        <p className="text-xs text-(--text-muted) wrap-break-word">{sk.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="prompt" className="mt-0 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-(--text-muted)">{t('promptBodyHint')}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {t('chars', { count: promptChars })}
                    </Badge>
                    <Badge variant="default" className="font-mono text-[10px]">
                      {t('tokens', { count: promptTokens })}
                    </Badge>
                  </div>
                </div>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={20}
                  className="min-h-90 w-full max-w-full resize-y rounded-xl border border-(--border-main) bg-(--bg-input) p-3.5 font-mono text-xs leading-relaxed text-(--text-main) focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                  placeholder={t('promptPlaceholder')}
                />
              </TabsContent>
        </div>
      </Tabs>
    </SheetTemplate>
  )
}
