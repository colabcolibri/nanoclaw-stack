import { type AgentItem, type SkillItem } from '@/api/client'
import { isSkillAssigned, normalizeSkillName } from '@/components/agents/agent-utils'

export type SkillScopeFilter = 'all' | 'global' | 'specialized' | 'unassigned'

export function getAgentsUsingSkill(skill: SkillItem, agents: AgentItem[]): AgentItem[] {
  if (skill.isGlobal) {
    return agents.filter((agent) => agent.allowGlobalSkills !== false)
  }
  return agents.filter((agent) => isSkillAssigned(agent, skill.name))
}

export function formatSkillTokens(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return value.toLocaleString('pt-BR')
}

export function filterSkills(
  skills: SkillItem[],
  agents: AgentItem[],
  query: string,
  scope: SkillScopeFilter
): SkillItem[] {
  const q = query.trim().toLowerCase()
  return skills.filter((skill) => {
    if (scope === 'global' && !skill.isGlobal) return false
    if (scope === 'specialized' && skill.isGlobal) return false
    if (scope === 'unassigned' && getAgentsUsingSkill(skill, agents).length > 0) return false
    if (!q) return true
    const agentHint = (skill.usedByAgents || []).join(' ').toLowerCase()
    return (
      skill.name.toLowerCase().includes(q) ||
      (skill.description || '').toLowerCase().includes(q) ||
      agentHint.includes(q)
    )
  })
}

export function countUnassignedSkills(skills: SkillItem[], agents: AgentItem[]): number {
  return skills.filter((skill) => getAgentsUsingSkill(skill, agents).length === 0).length
}

export function enrichSkillsWithAgents(skills: SkillItem[], agents: AgentItem[]): SkillItem[] {
  return skills.map((skill) => ({
    ...skill,
    usedByAgents: getAgentsUsingSkill(skill, agents).map((agent) => agent.name),
  }))
}

export function matchesSkillName(a: string, b: string): boolean {
  return normalizeSkillName(a) === normalizeSkillName(b)
}
