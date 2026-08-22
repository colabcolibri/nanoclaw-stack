import React, { useState, useEffect } from 'react'
import { Sparkles, RefreshCw, Search, Folder, Code2, Zap, AlignLeft, Bot, Globe, Lock, ChevronDown, ChevronRight, FileText } from 'lucide-react'
import { ApiClient, type SkillItem, type AgentItem } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { SkillDetailsDrawer } from '@/components/skills/SkillDetailsDrawer'

export const SkillsView: React.FC = () => {
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [agents, setAgents] = useState<AgentItem[]>([])
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false)
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set(['global']))

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [skillsData, agentsData] = await Promise.all([
        ApiClient.getSkills('barao'),
        ApiClient.getDepartmentsAndAgents('barao').catch(() => ({ agents: [], departments: [] })),
      ])
      setSkills(skillsData.skills || [])
      setAgents(agentsData.agents || [])
    } catch {} finally {
      setIsLoading(false)
    }
  }

  const norm = (s: string) => s.toLowerCase().replace(/-/g, '_')

  // Match a skill name to an agent's skill list (normalized)
  const agentOwnsSkill = (agent: AgentItem, skillName: string) =>
    agent.skills.some((s) => norm(s) === norm(skillName))

  // Split skills into global vs specialized
  const globalSkills = skills.filter((s) => s.isGlobal)
  const specializedSkills = skills.filter((s) => !s.isGlobal)

  // Build a map: agent id -> skill items
  const agentSkillMap = new Map<string, SkillItem[]>()
  for (const agent of agents) {
    const owned = specializedSkills.filter((sk) => agentOwnsSkill(agent, sk.name))
    agentSkillMap.set(agent.id, owned)
  }

  // Skills unassigned to any agent
  const unassigned = specializedSkills.filter(
    (sk) => !agents.some((ag) => agentOwnsSkill(ag, sk.name))
  )

  const toggleExpand = (id: string) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const formatK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString('pt-BR'))

  const matchesSearch = (sk: SkillItem) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return sk.name.toLowerCase().includes(q) || (sk.description || '').toLowerCase().includes(q)
  }

  const SkillCard = ({ skill }: { skill: SkillItem }) => (
    <div
      className="group flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-main)] hover:border-sky-500/40 cursor-pointer transition-all"
      onClick={() => { setSelectedSkill(skill); setIsDrawerOpen(true) }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles className="w-3.5 h-3.5 text-sky-500 shrink-0" />
        <span className="text-xs font-mono font-semibold text-[var(--text-main)] truncate">{skill.name}</span>
        {skill.references && skill.references.length > 0 && (
          <Badge variant="ref" className="text-[9px] py-0 px-1.5 gap-0.5 font-mono shrink-0">
            <Folder className="w-2.5 h-2.5" />
            {skill.references.length}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] text-[var(--text-dim)] font-mono">~{formatK(skill.totalTokens || 0)} tok</span>
        <span className="text-[10px] text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">Ver →</span>
      </div>
    </div>
  )

  const SectionHeader = ({
    id,
    icon,
    title,
    subtitle,
    count,
    color = 'sky',
  }: {
    id: string
    icon: React.ReactNode
    title: string
    subtitle?: string
    count: number
    color?: string
  }) => {
    const isOpen = expandedAgents.has(id)
    return (
      <button
        onClick={() => toggleExpand(id)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)] hover:border-sky-500/30 transition-all text-left group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-${color}-500/10 text-${color}-500 border border-${color}-500/20`}>
            {icon}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-[var(--text-main)] truncate">{title}</div>
            {subtitle && <div className="text-[11px] text-[var(--text-muted)] truncate">{subtitle}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="text-[10px] font-mono">{count}</Badge>
          {isOpen ? <ChevronDown className="w-4 h-4 text-[var(--text-dim)]" /> : <ChevronRight className="w-4 h-4 text-[var(--text-dim)]" />}
        </div>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-5 w-full flex-1">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-main)] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20 flex items-center justify-center shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Ferramentas & Habilidades</h1>
            <p className="text-xs text-[var(--text-muted)]">
              Skills globais (disponíveis a todos os agentes) e especializadas (atribuídas a um agente específico).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading} className="h-8 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
        <input
          type="text"
          placeholder="Filtrar skills por nome ou descrição..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl text-xs text-[var(--text-main)] focus:outline-hidden focus:border-sky-500"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-5">

          {/* ── GLOBAL SKILLS ── */}
          <div className="flex flex-col gap-2">
            <SectionHeader
              id="global"
              icon={<Globe className="w-4 h-4" />}
              title="Skills Globais"
              subtitle="Disponíveis a todos os agentes — memória, terminal, leitura de arquivos e contexto"
              count={globalSkills.filter(matchesSearch).length}
              color="emerald"
            />
            {expandedAgents.has('global') && (
              <div className="ml-4 border-l-2 border-emerald-500/20 pl-4 flex flex-col gap-1.5">
                {globalSkills.filter(matchesSearch).length === 0 ? (
                  <p className="text-xs text-[var(--text-dim)] py-2 italic">Nenhuma skill global encontrada.</p>
                ) : (
                  globalSkills.filter(matchesSearch).map((sk) => <SkillCard key={sk.name} skill={sk} />)
                )}
              </div>
            )}
          </div>

          {/* ── PER-AGENT SPECIALIZED SKILLS ── */}
          {agents.map((agent) => {
            const agentSkills = (agentSkillMap.get(agent.id) || []).filter(matchesSearch)
            if (!searchQuery && agentSkills.length === 0) return null
            if (searchQuery && agentSkills.length === 0) return null
            return (
              <div key={agent.id} className="flex flex-col gap-2">
                <SectionHeader
                  id={agent.id}
                  icon={<Bot className="w-4 h-4" />}
                  title={agent.name}
                  subtitle={agent.role}
                  count={agentSkills.length}
                  color="sky"
                />
                {expandedAgents.has(agent.id) && (
                  <div className="ml-4 border-l-2 border-sky-500/20 pl-4 flex flex-col gap-1.5">
                    {agentSkills.map((sk) => <SkillCard key={sk.name} skill={sk} />)}
                  </div>
                )}
              </div>
            )
          })}

          {/* ── UNASSIGNED SKILLS ── */}
          {unassigned.filter(matchesSearch).length > 0 && (
            <div className="flex flex-col gap-2">
              <SectionHeader
                id="unassigned"
                icon={<Lock className="w-4 h-4" />}
                title="Skills Não Atribuídas"
                subtitle="Existem no sistema mas nenhum agente as referencia ainda"
                count={unassigned.filter(matchesSearch).length}
                color="amber"
              />
              {expandedAgents.has('unassigned') && (
                <div className="ml-4 border-l-2 border-amber-500/20 pl-4 flex flex-col gap-1.5">
                  {unassigned.filter(matchesSearch).map((sk) => <SkillCard key={sk.name} skill={sk} />)}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {skills.length === 0 && !isLoading && (
            <EmptyState
              icon={<Sparkles className="w-8 h-8 text-[var(--text-dim)]" />}
              title="Nenhuma habilidade encontrada"
              description="Carregando lista de skills do contêiner..."
            />
          )}
        </div>
      )}

      <SkillDetailsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        skill={selectedSkill}
      />
    </div>
  )
}
