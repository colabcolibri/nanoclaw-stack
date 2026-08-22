import React, { useState, useEffect } from 'react'
import {
  Bot,
  Plus,
  Search,
  Cpu,
  Layers,
  Sparkles,
  RefreshCw,
  Folder,
  Globe,
  FileCode,
  CheckCircle2,
  Lock,
  ArrowRight,
  X,
} from 'lucide-react'
import { ApiClient, type AgentItem, type DepartmentItem, type SkillItem } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AgentDetailsDrawer } from './AgentDetailsDrawer'

export const AgentsView: React.FC = () => {
  const [departments, setDepartments] = useState<DepartmentItem[]>([])
  const [agents, setAgents] = useState<AgentItem[]>([])
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [selectedDept, setSelectedDept] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<AgentItem | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // New Agent Form state
  const [newId, setNewId] = useState('')
  const [newName, setNewName] = useState('')
  const [newDept, setNewDept] = useState('productivity')
  const [newRole, setNewRole] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [agentsData, skillsData] = await Promise.all([
        ApiClient.getDepartmentsAndAgents('barao'),
        ApiClient.getSkills('barao'),
      ])
      setDepartments(agentsData.departments || [])
      setAgents(agentsData.agents || [])
      setSkills(skillsData.skills || [])
    } catch (err) {
      console.error('Erro ao carregar dados de agentes:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredAgents = agents.filter((ag) => {
    const matchesDept = selectedDept === 'all' || ag.department === selectedDept
    const matchesSearch =
      searchQuery === '' ||
      ag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ag.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ag.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesDept && matchesSearch
  })

  const handleOpenAgent = (agent: AgentItem) => {
    setSelectedAgent(agent)
    setIsDrawerOpen(true)
  }

  const handleAgentSaved = (updated: AgentItem) => {
    setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    setSelectedAgent(updated)
  }

  const handleAgentDeleted = (agentId: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== agentId))
  }

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newId || !newName) return
    setIsCreating(true)
    try {
      const res = await ApiClient.createAgent('barao', {
        id: newId,
        name: newName,
        department: newDept,
        role: newRole || 'Especialista',
        description: newRole || 'Agente customizado',
        skills: [],
        allowGlobalSkills: true,
        model: 'deepseek-chat',
        systemPrompt: `Você é um agente especialista em ${newName}.\nExecute as tarefas técnicas solicitadas com precisão e retorne dados estruturados.`,
      })
      if (res.success && res.agent) {
        setAgents((prev) => [...prev, res.agent!])
        setIsCreateModalOpen(false)
        setNewId('')
        setNewName('')
        setNewRole('')
        handleOpenAgent(res.agent)
      }
    } catch (err) {
      console.error('Erro ao criar agente:', err)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto w-full text-[var(--text-main)]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-main)] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20 flex items-center justify-center shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Agentes & Departamentos</h1>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Arquitetura multi-agente: cada especialista possui seu próprio escopo técnico, prompt isolado e skills encapsuladas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading} className="text-xs">
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-sky-600 hover:bg-sky-700 text-white text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Novo Agente
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Department Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedDept('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedDept === 'all'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-[var(--bg-card)] border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Todos ({agents.length})
          </button>

          {departments.map((dept) => {
            const count = agents.filter((a) => a.department === dept.id).length
            const isSelected = selectedDept === dept.id
            return (
              <button
                key={dept.id}
                onClick={() => setSelectedDept(dept.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-[var(--bg-card)] border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {dept.name} ({count})
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative min-w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
          <input
            type="text"
            placeholder="Buscar por nome, cargo ou skill..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-hidden focus:border-sky-500"
          />
        </div>
      </div>

      {/* Agents Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)] animate-pulse" />
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="text-center py-16 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl p-8">
          <Bot className="w-10 h-10 text-[var(--text-dim)] mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-bold text-[var(--text-main)]">Nenhum agente encontrado</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Tente mudar o filtro de departamento ou o termo de busca.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map((ag) => {
            const deptObj = departments.find((d) => d.id === ag.department)
            return (
              <div
                key={ag.id}
                onClick={() => handleOpenAgent(ag)}
                className="group relative bg-[var(--bg-card)] border border-[var(--border-main)] hover:border-sky-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-lg cursor-pointer select-none"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <Badge variant="default" className="bg-sky-500/10 text-sky-500 border border-sky-500/20 text-[10px] font-mono">
                      {deptObj?.name || ag.department}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      {ag.model && (
                        <Badge variant="secondary" className="text-[10px] font-mono text-[var(--text-dim)]">
                          <Cpu className="w-2.5 h-2.5 mr-1" />
                          {ag.model}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Name & Role */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)] group-hover:border-sky-500/30 flex items-center justify-center text-sky-500 transition-colors">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-main)] group-hover:text-sky-500 transition-colors">
                        {ag.name}
                      </h3>
                      <p className="text-[11px] text-[var(--text-muted)] line-clamp-1">{ag.role}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[var(--text-dim)] line-clamp-2 mb-4 leading-relaxed">
                    {ag.description || ag.role}
                  </p>
                </div>

                {/* Skills & Footer */}
                <div className="border-t border-[var(--border-main)] pt-3 flex flex-col gap-2.5">
                  {/* Skills tags */}
                  <div className="flex flex-wrap gap-1">
                    {ag.skills.slice(0, 3).map((sk) => (
                      <span
                        key={sk}
                        className="px-2 py-0.5 rounded-md bg-[var(--bg-card-subtle)] border border-[var(--border-main)] text-[10px] font-mono text-[var(--text-muted)] flex items-center gap-1"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-sky-500" />
                        {sk}
                      </span>
                    ))}
                    {ag.skills.length > 3 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-[var(--bg-card-subtle)] text-[10px] font-mono text-[var(--text-dim)]">
                        +{ag.skills.length - 3}
                      </span>
                    )}
                    {ag.skills.length === 0 && (
                      <span className="text-[10px] text-[var(--text-dim)] italic">Sem skills específicas</span>
                    )}
                  </div>

                  {/* Footer Meta */}
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-dim)]">
                    <span className="font-mono">~{ag.systemPromptTokens || 0} tok prompt</span>
                    <span className="text-sky-500 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-semibold text-[11px]">
                      Abrir Agente
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Drawer */}
      <AgentDetailsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        agent={selectedAgent}
        departments={departments}
        availableSkills={skills}
        onAgentSaved={handleAgentSaved}
        onAgentDeleted={handleAgentDeleted}
      />

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl shadow-2xl p-6 flex flex-col gap-4 text-[var(--text-main)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-main)] pb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-sky-500" />
                <h3 className="text-sm font-bold">Criar Novo Agente Especialista</h3>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)}>
                <X className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>

            <form onSubmit={handleCreateAgent} className="flex flex-col gap-3.5">
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">ID do Agente (Slug único)</label>
                <input
                  type="text"
                  placeholder="ex: financial_analyst"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))}
                  required
                  className="w-full bg-[var(--bg-card-subtle)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] font-mono focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Nome de Exibição</label>
                <input
                  type="text"
                  placeholder="ex: Analista Financeiro & Contábil"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full bg-[var(--bg-card-subtle)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Departamento</label>
                <select
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  className="w-full bg-[var(--bg-card-subtle)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-hidden focus:border-sky-500"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Cargo / Especialidade</label>
                <input
                  type="text"
                  placeholder="ex: Especialista em conciliação bancária e DRE"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-[var(--bg-card-subtle)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-main)]">
                <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateModalOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="default" size="sm" type="submit" disabled={isCreating} className="bg-sky-600 text-white">
                  {isCreating ? 'Criando...' : 'Criar Agente'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
