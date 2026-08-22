import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Bot, Plus, RefreshCw } from 'lucide-react'
import { ApiClient, type AgentItem, type DepartmentItem, type SkillItem } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { FilterChips } from '@/components/common/FilterChips'
import { SearchInput } from '@/components/common/SearchInput'
import { EmptyState } from '@/components/common/EmptyState'
import { AgentCard } from '@/components/agents/AgentCard'
import { AgentDetailsDrawer } from '@/components/agents/AgentDetailsDrawer'
import { CreateAgentDialog } from '@/components/agents/CreateAgentDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const AgentsView: React.FC = () => {
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
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      q === '' ||
      ag.name.toLowerCase().includes(q) ||
      ag.role.toLowerCase().includes(q) ||
      ag.skills.some((s) => s.toLowerCase().includes(q))
    return matchesDept && matchesSearch
  })

  const deptChips = [
    { id: 'all', label: t('filterAll'), count: agents.length },
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
    if (!createForm.id || !createForm.name) return
    setIsCreating(true)
    try {
      const res = await ApiClient.createAgent('barao', {
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
    <div className="flex min-h-0 w-full flex-1 flex-col gap-5 text-[var(--text-main)]">
      <PageHeader
        view="agents"
        subtitle={t('subtitle')}
        actions={
          <>
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
          </>
        }
      />

      <FilterChips chips={deptChips} selected={selectedDept} onSelect={setSelectedDept} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--text-main)]">
              {selectedDept === 'all' ? t('sectionAll') : selectedDeptObj?.name}
            </h2>
            <Badge variant="secondary" className="font-mono text-[10px]">
              {t('agentCount', { count: filteredAgents.length })}
            </Badge>
          </div>
          {selectedDept !== 'all' && selectedDeptObj?.description && (
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{selectedDeptObj.description}</p>
          )}
        </div>
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('searchPlaceholder')}
          className="w-full sm:max-w-xs"
        />
      </div>

      <Card className="border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-[var(--border-main)] px-4 py-3 sm:px-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {t('gridTitle')}
              </p>
              <p className="text-[11px] text-[var(--text-dim)]">{t('gridSubtitle')}</p>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-48 rounded-xl" />
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredAgents.map((ag) => (
                  <AgentCard
                    key={ag.id}
                    agent={ag}
                    department={departments.find((d) => d.id === ag.department)}
                    onClick={() => handleOpenAgent(ag)}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
