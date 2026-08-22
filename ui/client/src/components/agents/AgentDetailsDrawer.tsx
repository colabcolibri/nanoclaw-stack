import React, { useState, useEffect } from 'react'
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
      <SheetContent side="right" className="w-full max-w-3xl sm:max-w-3xl overflow-y-auto p-0">
        <div className="flex flex-col h-full p-6">
          <SheetHeader className="border-b border-[var(--border-main)] pb-4 mb-4 space-y-0">
            <div className="flex items-start gap-3 pr-8">
              <div className="w-11 h-11 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)] flex items-center justify-center shrink-0">
                <Bot className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="flex items-center gap-2 flex-wrap text-lg">
                  {name || agent.id}
                  <Badge variant="default" className="font-mono text-[11px]">
                    {department}
                  </Badge>
                  {model && (
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      <Cpu className="w-3 h-3 mr-1" />
                      {model}
                    </Badge>
                  )}
                  {agent.isCustom && (
                    <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px]">
                      Customizado
                    </Badge>
                  )}
                </SheetTitle>
                <SheetDescription className="mt-1">{role || 'Agente especialista'}</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full justify-start flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="overview" className="gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Metadados & YAML
              </TabsTrigger>
              <TabsTrigger value="prompt" className="gap-1.5">
                <FileCode className="w-3.5 h-3.5" />
                System Prompt ({promptTokens} tokens)
              </TabsTrigger>
              <TabsTrigger value="skills_ref" className="gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                Skills ({selectedSkills.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="flex-1 overflow-y-auto">
              <div className="flex flex-col gap-5 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome de exibição</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} className="text-xs" />
                  </div>
                  <div className="space-y-2">
                    <Label>Departamento</Label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="flex h-9 w-full rounded-lg border border-[var(--border-main)] bg-[var(--bg-input)] px-3 text-xs text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cargo / especialidade (role)</Label>
                    <Input value={role} onChange={(e) => setRole(e.target.value)} className="text-xs" />
                  </div>
                  <div className="space-y-2">
                    <Label>Modelo dedicado</Label>
                    <ModelSelect
                      providers={providers}
                      value={model}
                      onChange={setModel}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                  />
                </div>

                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)]">
                  <input
                    type="checkbox"
                    id="allow_global"
                    checked={allowGlobalSkills}
                    onChange={(e) => setAllowGlobalSkills(e.target.checked)}
                    className="rounded w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="allow_global" className="text-xs text-[var(--text-main)] cursor-pointer flex-1">
                    <span className="font-semibold block">Permitir skills globais de utilidade</span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Garante acesso a ferramentas essenciais do sistema: leitura de arquivos, terminal seguro, gerenciamento de memória e contexto.
                    </span>
                  </label>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Skills exclusivas atribuídas</Label>
                    <span className="text-[11px] text-[var(--accent)] font-mono font-semibold">
                      {selectedSkills.length} selecionada(s)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-[var(--bg-card-subtle)] border border-[var(--border-main)] rounded-xl">
                    {availableSkills
                      .filter((sk) => !sk.isGlobal)
                      .map((sk) => {
                        const isChecked = isSkillSelected(sk.name)
                        return (
                          <div
                            key={sk.name}
                            onClick={() => handleToggleSkill(sk.name)}
                            className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all select-none ${
                              isChecked
                                ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--accent)] font-medium'
                                : 'border-transparent hover:bg-[var(--bg-card)] text-[var(--text-muted)]'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center ${
                                isChecked ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'border-[var(--border-main)]'
                              }`}
                            >
                              {isChecked && <Check className="w-3 h-3" />}
                            </div>
                            <span className="font-mono truncate">{sk.name}</span>
                          </div>
                        )
                      })}
                  </div>
                </div>

                <div>
                  <Label className="mb-1.5 block">Estrutura YAML de topo (AGENT.md)</Label>
                  <pre className="p-3 bg-[var(--bg-card-subtle)] border border-[var(--border-main)] rounded-xl text-[11px] font-mono text-[var(--text-dim)] overflow-x-auto">
                    {yamlPreview}
                  </pre>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="prompt" className="flex-1 overflow-y-auto">
              <div className="flex flex-col gap-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-muted)]">
                    System prompt executado pelo especialista — estritamente técnico e objetivo.
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {promptChars} caracteres
                    </Badge>
                    <Badge variant="default" className="font-mono text-[10px]">
                      ~{promptTokens} tokens
                    </Badge>
                  </div>
                </div>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={16}
                  className="w-full flex-1 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl p-3.5 font-mono text-xs text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 leading-relaxed resize-none min-h-[280px]"
                  placeholder="Você é um agente especialista em..."
                />
              </div>
            </TabsContent>

            <TabsContent value="skills_ref" className="flex-1 overflow-y-auto">
              <div className="flex flex-col gap-4 pt-2">
                {assignedSkillObjects.length === 0 ? (
                  <div className="text-center py-12 text-xs text-[var(--text-muted)]">
                    Nenhuma skill atribuída. Marque skills na aba &quot;Metadados & YAML&quot;.
                  </div>
                ) : (
                  assignedSkillObjects.map((sk) => (
                    <div
                      key={sk.name}
                      className="p-4 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)] flex flex-col gap-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                          <span className="text-xs font-bold font-mono">{sk.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          ~{sk.totalTokens || 0} tokens
                        </Badge>
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">{sk.description}</p>
                      {sk.references && sk.references.length > 0 && (
                        <div className="border-t border-[var(--border-main)] pt-2.5">
                          <div className="text-[11px] font-semibold text-[var(--text-dim)] mb-1.5 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5" />
                            Documentos de referência ({sk.references.length})
                          </div>
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
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-between border-t border-[var(--border-main)] pt-4 mt-4 shrink-0">
            <div>
              {agent.isCustom && (
                <Button variant="destructive" size="sm" onClick={handleDelete} className="text-xs">
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Excluir
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
                Cancelar
              </Button>
              <Button variant="default" size="sm" onClick={handleSave} disabled={isSaving} className="text-xs">
                {saveSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Salvo!
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-1" />
                    {isSaving ? 'Salvando...' : 'Salvar agente'}
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
