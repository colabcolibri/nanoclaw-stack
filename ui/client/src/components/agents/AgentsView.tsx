import React, { useState, useEffect, useMemo } from 'react'
import { useDefaultGroup } from '@/contexts/AppConfigContext'
import { useTranslation } from 'react-i18next'
import { Bot, Plus, RefreshCw } from 'lucide-react'
import { ApiClient, type AgentItem, type DepartmentItem, type SkillItem } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { AgentCard } from '@/components/agents/AgentCard'
import { AgentFilterBar } from '@/components/agents/AgentFilterBar'
import { AgentDetailsDrawer } from '@/components/agents/AgentDetailsDrawer'
import { CreateAgentDialog } from '@/components/agents/CreateAgentDialog'
import { getAgentContextTokens, getDepartmentChipLabel } from '@/components/agents/agent-utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export const AgentsView: React.FC = () => {
  const group = useDefaultGroup()
  const { t } = useTranslation('agents')
  const [departments, setDepartments] = useState<DepartmentItem[]>([])
  const [agents, setAgents] = useState<AgentItem[]>([])
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [selectedDept, setSelectedDept] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAgent, setSelectedAgent] = useState<AgentItem | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    id: '',
    name: '',
    department: 'productivity',
    role: '',
  })
  const [isCreating, setIsCreating] = useState(false)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [agentsData, skillsData] = await Promise.all([
        ApiClient.getDepartmentsAndAgents(group),
        ApiClient.getSkills(group),
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
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      q === '' ||
      ag.name.toLowerCase().includes(q) ||
      ag.role.toLowerCase().includes(q) ||
      ag.skills.some((s) => s.toLowerCase().includes(q))
    return matchesDept && matchesSearch
  })

  const deptChips = [
    { id: 'all', label: t('filterAll') },
    ...departments.map((dept) => ({
      id: dept.id,
      label: getDepartmentChipLabel(dept.name),
    })),
  ]

  const maxContextTokens = useMemo(() => {
    const loads = agents.map((ag) => getAgentContextTokens(ag, skills))
    return Math.max(...loads, 1)
  }, [agents, skills])

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
    setSelectedAgent(null)
  }

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.id || !createForm.name) return
    setIsCreating(true)
    try {
      const res = await ApiClient.createAgent(group, {
        id: createForm.id,
        name: createForm.name,
        department: createForm.department,
        role: createForm.role || 'Especialista',
        description: createForm.role || 'Agente customizado',
        skills: [],
        allowGlobalSkills: true,
        model: 'deepseek-chat',
        systemPrompt: `Você é um agente especialista em ${createForm.name}.\nExecute as tarefas técnicas solicitadas com precisão e retorne dados estruturados.`,
      })
      if (res.success && res.agent) {
        setAgents((prev) => [...prev, res.agent!])
        setIsCreateModalOpen(false)
        setCreateForm({ id: '', name: '', department: 'productivity', role: '' })
        handleOpenAgent(res.agent)
      }
    } catch (err) {
      console.error('Erro ao criar agente:', err)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="flex min-h-0 w-full max-w-full flex-1 flex-col gap-8 overflow-x-hidden text-[var(--text-main)]">
      <PageHeader view="agents" subtitle={t('subtitle')} />

      <AgentFilterBar
        chips={deptChips}
        selected={selectedDept}
        onSelect={setSelectedDept}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={t('searchPlaceholder')}
      />

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={isLoading}
          className="h-8 text-xs"
        >
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => setIsCreateModalOpen(true)}
          className="h-8 text-xs"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('newAgent')}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <EmptyState
          icon={<Bot className="h-8 w-8 text-[var(--text-dim)]" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={
            <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {t('newAgent')}
            </Button>
          }
        />
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {filteredAgents.map((ag) => {
            const contextTokens = getAgentContextTokens(ag, skills)
            const usagePercent = Math.round((contextTokens / maxContextTokens) * 100)
            return (
              <AgentCard
                key={ag.id}
                agent={ag}
                department={departments.find((d) => d.id === ag.department)}
                skills={skills}
                isSelected={selectedAgent?.id === ag.id && isDrawerOpen}
                usagePercent={usagePercent}
                onClick={() => handleOpenAgent(ag)}
                onMenuClick={() => handleOpenAgent(ag)}
              />
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

      <CreateAgentDialog
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        departments={departments}
        form={createForm}
        onChange={(patch) => setCreateForm((prev) => ({ ...prev, ...patch }))}
        onSubmit={handleCreateAgent}
        isCreating={isCreating}
      />
    </div>
  )
}
