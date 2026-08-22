import React, { useState, useEffect } from 'react'
import {
  X,
  Bot,
  FileCode,
  Sparkles,
  Check,
  Save,
  Trash2,
  Cpu,
  Layers,
  BookOpen,
  Code2,
  FileText,
  CheckCircle2,
  Globe,
  Lock,
} from 'lucide-react'
import { type AgentItem, type DepartmentItem, type SkillItem, ApiClient } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { parseMarkdown } from '@/lib/markdown'

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
  const [activeTab, setActiveTab] = useState<'overview' | 'prompt' | 'skills_ref'>('overview')
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

  if (!isOpen || !agent) return null

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

  const assignedSkillObjects = availableSkills.filter((s) => selectedSkills.includes(s.name))

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity cursor-pointer"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-[var(--bg-card)] border-l border-[var(--border-main)] shadow-2xl p-6 flex flex-col z-10 overflow-y-auto animate-in slide-in-from-right duration-200 text-[var(--text-main)] cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between border-b border-[var(--border-main)] pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20 flex items-center justify-center shadow-xs">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-[var(--text-main)]">{name || agent.id}</h3>
                <Badge variant="default" className="bg-sky-600 text-white font-mono text-[11px]">
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
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">{role || 'Agente Especialista'}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-subtle)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-[var(--border-main)] mb-6 pb-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'overview'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-subtle)]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Metadados & YAML
          </button>
          <button
            onClick={() => setActiveTab('prompt')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'prompt'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-subtle)]'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            System Prompt ({promptTokens} tokens)
          </button>
          <button
            onClick={() => setActiveTab('skills_ref')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'skills_ref'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-subtle)]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Skills & Referências ({selectedSkills.length})
          </button>
        </div>

        {/* Tab 1: Overview & YAML */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-5 flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Nome de Exibição</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[var(--bg-card-subtle)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Departamento</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-[var(--bg-card-subtle)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-hidden focus:border-sky-500"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Cargo / Especialidade (Role)</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-[var(--bg-card-subtle)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Modelo Preferido</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="deepseek-chat"
                  className="w-full bg-[var(--bg-card-subtle)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-hidden focus:border-sky-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Descrição</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-[var(--bg-card-subtle)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-hidden focus:border-sky-500"
              />
            </div>

            {/* Global Skills Toggle */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)]">
              <input
                type="checkbox"
                id="allow_global"
                checked={allowGlobalSkills}
                onChange={(e) => setAllowGlobalSkills(e.target.checked)}
                className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="allow_global" className="text-xs text-[var(--text-main)] cursor-pointer flex-1">
                <span className="font-semibold block">Permitir Skills Globais de Utilidade</span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Garante acesso a ferramentas essenciais do sistema: leitura de arquivos, terminal seguro, gerenciamento de memória e contexto.
                </span>
              </label>
            </div>

            {/* Skills Assignment Multi-Select */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-[var(--text-muted)]">
                  Skills Exclusivas Atribuídas a este Agente
                </label>
                <span className="text-[11px] text-sky-500 font-mono font-semibold">
                  {selectedSkills.length} selecionada(s)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-[var(--bg-card-subtle)] border border-[var(--border-main)] rounded-xl">
                {availableSkills.map((sk) => {
                  const isChecked = selectedSkills.includes(sk.name)
                  return (
                    <div
                      key={sk.name}
                      onClick={() => handleToggleSkill(sk.name)}
                      className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all select-none ${
                        isChecked
                          ? 'bg-sky-500/10 border-sky-500/40 text-sky-500 font-medium'
                          : 'border-transparent hover:bg-[var(--bg-card)] text-[var(--text-muted)]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          isChecked ? 'bg-sky-600 border-sky-600 text-white' : 'border-[var(--border-main)]'
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

            {/* Live YAML Frontmatter Preview */}
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">
                Estrutura YAML de Topo (AGENT.md)
              </label>
              <pre className="p-3 bg-[var(--bg-card-subtle)] border border-[var(--border-main)] rounded-xl text-[11px] font-mono text-[var(--text-dim)] overflow-x-auto">
                {yamlPreview}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 2: System Prompt */}
        {activeTab === 'prompt' && (
          <div className="flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">
                Este é o System Prompt executado pelo Especialista. Deve ser estritamente técnico e objetivo.
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {promptChars} caracteres
                </Badge>
                <Badge variant="default" className="bg-sky-600 text-white font-mono text-[10px]">
                  ~{promptTokens} tokens
                </Badge>
              </div>
            </div>

            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={16}
              className="w-full flex-1 bg-[var(--bg-card-subtle)] border border-[var(--border-main)] rounded-xl p-3.5 font-mono text-xs text-[var(--text-main)] focus:outline-hidden focus:border-sky-500 leading-relaxed resize-none"
              placeholder="Você é um agente especialista em..."
            />
          </div>
        )}

        {/* Tab 3: Skills & References */}
        {activeTab === 'skills_ref' && (
          <div className="flex flex-col gap-4 flex-1 overflow-y-auto">
            {assignedSkillObjects.length === 0 ? (
              <div className="text-center py-12 text-xs text-[var(--text-muted)]">
                Nenhuma skill atribuída a este agente. Marque skills na aba "Metadados & YAML".
              </div>
            ) : (
              assignedSkillObjects.map((sk) => (
                <div
                  key={sk.name}
                  className="p-4 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)] flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-sky-500" />
                      <span className="text-xs font-bold text-[var(--text-main)] font-mono">{sk.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      ~{sk.totalTokens || 0} tokens
                    </Badge>
                  </div>

                  <p className="text-xs text-[var(--text-muted)]">{sk.description}</p>

                  {/* References */}
                  {sk.references && sk.references.length > 0 && (
                    <div className="border-t border-[var(--border-main)] pt-2.5">
                      <div className="text-[11px] font-semibold text-[var(--text-dim)] mb-1.5 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Documentos de Referência ({sk.references.length})
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
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-[var(--border-main)] pt-4 mt-5">
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
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-sky-600 hover:bg-sky-700 text-white text-xs"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Salvo com sucesso!
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 mr-1" />
                  {isSaving ? 'Salvando...' : 'Salvar Agente'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
