import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bot,
  FileCode,
  Sparkles,
  Check,
  Save,
  Trash2,
  Cpu,
  Layers,
  BookOpen,
  FileText,
} from 'lucide-react'
import { type AgentItem, type DepartmentItem, type SkillItem, ApiClient } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ModelSelect } from '@/components/common/ModelSelect'
import { useLlmRegistry } from '@/hooks/useLlmRegistry'

interface AgentDetailsDrawerProps {
  isOpen: boolean
  onClose: () => void
  agent: AgentItem | null
  departments: DepartmentItem[]
  availableSkills: SkillItem[]
  onAgentSaved: (updated: AgentItem) => void
  onAgentDeleted?: (agentId: string) => void
}

export const AgentDetailsDrawer: React.FC<AgentDetailsDrawerProps> = ({
  isOpen,
  onClose,
  agent,
  departments,
  availableSkills,
  onAgentSaved,
  onAgentDeleted,
}) => {
  const { t } = useTranslation('agents')
  const { providers } = useLlmRegistry()
  const [activeTab, setActiveTab] = useState('overview')
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [role, setRole] = useState('')
  const [description, setDescription] = useState('')
  const [model, setModel] = useState('')
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
      setModel(agent.model || 'deepseek-chat')
      setAllowGlobalSkills(agent.allowGlobalSkills !== false)
      setSelectedSkills(agent.skills || [])
      setSystemPrompt(agent.systemPrompt || '')
      setSaveSuccess(false)
      setActiveTab('overview')
    }
  }, [agent])

  if (!agent) return null

  const promptChars = systemPrompt.length
  const promptTokens = Math.ceil(promptChars / 3.8)

  const handleToggleSkill = (skillName: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillName) ? prev.filter((s) => s !== skillName) : [...prev, skillName]
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await ApiClient.saveAgent('barao', agent.id, {
        name,
        department,
        role,
        description,
        model,
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
    if (!confirm(`Tem certeza que deseja excluir o agente "${agent.name}"?`)) return
    try {
      const res = await ApiClient.deleteAgent('barao', agent.id)
      if (res.success) {
        onAgentDeleted?.(agent.id)
        onClose()
      }
    } catch (err) {
      console.error('Erro ao excluir agente:', err)
    }
  }

  const yamlPreview = `---
id: ${agent.id}
name: "${name.replace(/"/g, '\\"')}"
department: ${department}
role: "${role.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
skills:
${selectedSkills.length > 0 ? selectedSkills.map((s) => `  - ${s}`).join('\n') : '  []'}
allow_global_skills: ${allowGlobalSkills}
model: ${model || 'deepseek-chat'}
---`

  const norm = (s: string) => s.toLowerCase().replace(/-/g, '_')
  const selectedNorm = new Set(selectedSkills.map(norm))
  const isSkillSelected = (skillName: string) =>
    selectedSkills.includes(skillName) || selectedNorm.has(norm(skillName))
  const assignedSkillObjects = availableSkills.filter((s) => isSkillSelected(s.name))

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full max-w-lg flex-col overflow-hidden p-0 sm:max-w-lg">
        <div className="flex h-full flex-col">
          <SheetHeader className="space-y-0 border-b border-[var(--border-main)] px-6 pb-4 pt-6">
            <div className="flex items-start gap-3 pr-8">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--accent)]">
                <Bot className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="flex flex-wrap items-center gap-2 text-base">
                  <span className="truncate">{name || agent.id}</span>
                  <Badge variant="success" className="text-[10px]">
                    {t('drawerActive')}
                  </Badge>
                </SheetTitle>
                <SheetDescription className="mt-1 text-xs">
                  {role || t('drawerRoleFallback')}
                </SheetDescription>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="default" className="font-mono text-[10px]">
                    {department}
                  </Badge>
                  {model && (
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      <Cpu className="mr-1 h-3 w-3" />
                      {model}
                    </Badge>
                  )}
                  {agent.isCustom && (
                    <Badge variant="outline" className="border-emerald-500/30 text-[10px] text-emerald-500">
                      {t('drawerCustom')}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </SheetHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="border-b border-[var(--border-main)] px-6">
              <TabsList className="h-auto w-full justify-start gap-1 bg-transparent p-0">
                <TabsTrigger value="overview" className="gap-1.5 text-xs">
                  <Layers className="h-3.5 w-3.5" />
                  {t('drawerOverview')}
                </TabsTrigger>
                <TabsTrigger value="prompt" className="gap-1.5 text-xs">
                  <FileCode className="h-3.5 w-3.5" />
                  {t('drawerPrompt')}
                </TabsTrigger>
                <TabsTrigger value="skills_ref" className="gap-1.5 text-xs">
                  <BookOpen className="h-3.5 w-3.5" />
                  {t('drawerSkills')} ({selectedSkills.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <TabsContent value="overview" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label>{t('displayName')}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="text-xs" />
                </div>

                <div className="space-y-2">
                  <Label>{t('department')}</Label>
                  <Select value={department} onValueChange={setDepartment}>
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

                <div className="space-y-2">
                  <Label>{t('role')}</Label>
                  <Input value={role} onChange={(e) => setRole(e.target.value)} className="text-xs" />
                </div>

                <div className="space-y-2">
                  <Label>{t('dedicatedModel')}</Label>
                  <ModelSelect
                    providers={providers}
                    value={model}
                    onChange={setModel}
                    className="w-full rounded-lg border border-[var(--border-main)] bg-[var(--bg-input)] px-3 py-2 font-mono text-xs text-[var(--text-main)]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('description')}</Label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-[var(--border-main)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                  />
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card-subtle)] p-3.5">
                  <input
                    type="checkbox"
                    checked={allowGlobalSkills}
                    onChange={(e) => setAllowGlobalSkills(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded"
                  />
                  <span className="text-xs text-[var(--text-main)]">
                    <span className="block font-semibold">{t('allowGlobalSkills')}</span>
                    <span className="text-[11px] text-[var(--text-muted)]">{t('allowGlobalSkillsHint')}</span>
                  </span>
                </label>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label>{t('assignedSkills')}</Label>
                    <span className="font-mono text-[11px] font-semibold text-[var(--accent)]">
                      {t('skillsSelected', { count: selectedSkills.length })}
                    </span>
                  </div>
                  <div className="grid max-h-44 grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-[var(--border-main)] bg-[var(--bg-card-subtle)] p-2">
                    {availableSkills
                      .filter((sk) => !sk.isGlobal)
                      .map((sk) => {
                        const isChecked = isSkillSelected(sk.name)
                        return (
                          <button
                            key={sk.name}
                            type="button"
                            onClick={() => handleToggleSkill(sk.name)}
                            className={`flex items-center gap-2.5 rounded-lg border p-2 text-left text-xs transition-all ${
                              isChecked
                                ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)] font-medium text-[var(--accent)]'
                                : 'border-transparent text-[var(--text-muted)] hover:bg-[var(--bg-card)]'
                            }`}
                          >
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                isChecked
                                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                                  : 'border-[var(--border-main)]'
                              }`}
                            >
                              {isChecked && <Check className="h-3 w-3" />}
                            </span>
                            <span className="truncate font-mono">{sk.name}</span>
                          </button>
                        )
                      })}
                  </div>
                </div>

                <div>
                  <Label className="mb-1.5 block">{t('yamlPreview')}</Label>
                  <pre className="overflow-x-auto rounded-lg border border-[var(--border-main)] bg-[var(--bg-card-subtle)] p-3 font-mono text-[11px] text-[var(--text-dim)]">
                    {yamlPreview}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="prompt" className="mt-0 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-[var(--text-muted)]">{t('promptHint')}</p>
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
                  rows={18}
                  className="min-h-[320px] w-full resize-none rounded-xl border border-[var(--border-main)] bg-[var(--bg-input)] p-3.5 font-mono text-xs leading-relaxed text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                  placeholder="Você é um agente especialista em..."
                />
              </TabsContent>

              <TabsContent value="skills_ref" className="mt-0 space-y-3">
                {assignedSkillObjects.length === 0 ? (
                  <p className="py-8 text-center text-xs text-[var(--text-muted)]">
                    {t('noAssignedSkills')}
                  </p>
                ) : (
                  assignedSkillObjects.map((sk) => (
                    <div
                      key={sk.name}
                      className="flex flex-col gap-3 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card-subtle)] p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Sparkles className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                          <span className="truncate font-mono text-xs font-bold">{sk.name}</span>
                        </div>
                        <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                          ~{sk.totalTokens || 0} tok
                        </Badge>
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">{sk.description}</p>
                      {sk.references && sk.references.length > 0 && (
                        <div className="border-t border-[var(--border-main)] pt-2.5">
                          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-dim)]">
                            <FileText className="h-3.5 w-3.5" />
                            {t('refDocs', { count: sk.references.length })}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {sk.references.map((rf) => (
                              <Badge key={rf.name} variant="outline" className="font-mono text-[10px]">
                                {rf.name} ({rf.tokenCount || 0} tok)
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>
            </div>
          </Tabs>

          <div className="flex shrink-0 items-center justify-between border-t border-[var(--border-main)] px-6 py-4">
            <div>
              {agent.isCustom && (
                <Button variant="destructive" size="sm" onClick={handleDelete} className="text-xs">
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  {t('delete')}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
                {t('cancel')}
              </Button>
              <Button variant="default" size="sm" onClick={handleSave} disabled={isSaving} className="text-xs">
                {saveSuccess ? (
                  <>
                    <Check className="mr-1 h-3.5 w-3.5" />
                    {t('saved')}
                  </>
                ) : (
                  <>
                    <Save className="mr-1 h-3.5 w-3.5" />
                    {isSaving ? t('saving') : t('save')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
