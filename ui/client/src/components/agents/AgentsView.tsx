import React, { useState, useEffect } from 'react'
import {
  Bot,
  Plus,
  Cpu,
  Sparkles,
  RefreshCw,
  ArrowRight,
} from 'lucide-react'
import { ApiClient, type AgentItem, type DepartmentItem, type SkillItem } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { FilterChips } from '@/components/common/FilterChips'
import { SearchInput } from '@/components/common/SearchInput'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

  const selectedDeptObj = departments.find((d) => d.id === selectedDept)

  const filteredAgents = agents.filter((ag) => {
    const matchesDept = selectedDept === 'all' || ag.department === selectedDept
    const matchesSearch =
      searchQuery === '' ||
      ag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ag.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ag.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesDept && matchesSearch
  })

  const deptChips = [
    { id: 'all', label: 'Todos', count: agents.length },
    ...departments.map((dept) => ({
      id: dept.id,
      label: dept.name,
      count: agents.filter((a) => a.department === dept.id).length,
    })),
  ]

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
    <div className="flex flex-col gap-5 w-full text-[var(--text-main)] flex-1 min-h-0">
      <PageHeader
        view="agents"
        subtitle="Estrutura modular multi-agente: o orquestrador raciocina por departamento e delega a especialistas com skills isoladas."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading} className="text-xs h-8">
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="default" size="sm" onClick={() => setIsCreateModalOpen(true)} className="text-xs h-8">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Novo agente
            </Button>
          </>
        }
      />

      <FilterChips chips={deptChips} selected={selectedDept} onSelect={setSelectedDept} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-main)]">
              {selectedDept === 'all' ? 'Todos os especialistas' : selectedDeptObj?.name}
            </h3>
            <Badge variant="secondary" className="text-[10px] font-mono">
              {filteredAgents.length} agente(s)
            </Badge>
          </div>
          {selectedDept !== 'all' && selectedDeptObj?.description && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{selectedDeptObj.description}</p>
          )}
        </div>
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Filtrar por nome, cargo ou skill..."
          className="sm:max-w-xs"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-44 rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <EmptyState
          icon={<Bot className="w-8 h-8 text-[var(--text-dim)]" />}
          title="Nenhum agente encontrado"
          description="Tente alterar o departamento ou o termo de busca."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAgents.map((ag) => {
            const deptObj = departments.find((d) => d.id === ag.department)
            return (
              <Card
                key={ag.id}
                className="group cursor-pointer select-none transition-all hover:border-[var(--accent)]/40 hover:shadow-md"
                onClick={() => handleOpenAgent(ag)}
              >
                <CardContent className="p-4 flex flex-col justify-between gap-3 h-full">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <Badge variant="default" className="text-[10px] font-mono">
                        {deptObj?.name || ag.department}
                      </Badge>
                      <div className="flex items-center gap-1.5">
                        {ag.model && (
                          <Badge variant="secondary" className="text-[10px] font-mono text-[var(--text-dim)]">
                            <Cpu className="w-2.5 h-2.5 mr-1" />
                            {ag.model}
                          </Badge>
                        )}
                        {ag.isCustom && (
                          <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[9px]">
                            Custom
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-[var(--bg-card-subtle)] border border-[var(--border-main)] group-hover:border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] shrink-0">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-[var(--text-main)] group-hover:text-[var(--accent)] truncate">
                          {ag.name}
                        </h3>
                        <p className="text-xs text-[var(--text-muted)] line-clamp-1">{ag.role}</p>
                      </div>
                    </div>

                    <p className="text-xs text-[var(--text-dim)] line-clamp-2 leading-relaxed">
                      {ag.description || ag.role}
                    </p>
                  </div>

                  <div className="border-t border-[var(--border-main)] pt-3 flex flex-col gap-2">
                    <div className="flex flex-wrap gap-1">
                      {ag.skills.slice(0, 3).map((sk) => (
                        <span
                          key={sk}
                          className="px-2 py-0.5 rounded-md bg-[var(--bg-card-subtle)] border border-[var(--border-main)] text-[10px] font-mono text-[var(--text-muted)] flex items-center gap-1"
                        >
                          <Sparkles className="w-2.5 h-2.5 text-[var(--accent)]" />
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

                    <div className="flex items-center justify-between text-[11px] text-[var(--text-dim)]">
                      <span className="font-mono text-[10px]">~{ag.systemPromptTokens || 0} tok prompt</span>
                      <span className="text-[var(--accent)] group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-semibold">
                        Inspecionar
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <AgentDetailsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        agent={selectedAgent}
        departments={departments}
        availableSkills={skills}
        onAgentSaved={handleAgentSaved}
        onAgentDeleted={handleAgentDeleted}
      />

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-[var(--accent)]" />
              Criar novo agente especialista
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateAgent} className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="agent-id">ID do agente (slug único)</Label>
              <Input
                id="agent-id"
                type="text"
                placeholder="ex: financial_analyst"
                value={newId}
                onChange={(e) => setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))}
                required
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-name">Nome de exibição</Label>
              <Input
                id="agent-name"
                type="text"
                placeholder="ex: Analista financeiro & contábil"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={newDept} onValueChange={setNewDept}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Selecione o departamento" />
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
              <Label htmlFor="agent-role">Cargo / especialidade</Label>
              <Input
                id="agent-role"
                type="text"
                placeholder="ex: Especialista em conciliação bancária e DRE"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="text-xs"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button variant="default" size="sm" type="submit" disabled={isCreating}>
                {isCreating ? 'Criando...' : 'Criar agente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
