import {
  Bot,
  Calendar,
  Globe,
  LineChart,
  Network,
  Plane,
  Settings2,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react'
import { type AgentItem, type SkillItem } from '@/api/client'
import type { InferenceParamsForm } from '@/components/config/RoleInferenceParamsForm'
import { formatNumber } from '../../lib/formatters'


const DEPT_ICONS: Record<string, LucideIcon> = {
  productivity: Calendar,
  commerce: ShoppingBag,
  research_intel: Globe,
  operations: Settings2,
}

const AGENT_ICONS: LucideIcon[] = [LineChart, Network, Plane, Bot]

export function getDepartmentChipLabel(name: string): string {
  const segment = name.split(/[,&]/)[0]?.trim()
  return segment || name
}

export function formatTokenCount(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return formatNumber(value)
}

export function getDepartmentIcon(deptId: string): LucideIcon {
  return DEPT_ICONS[deptId] || Settings2
}

export function getAgentIcon(agent: AgentItem): LucideIcon {
  const idx =
    agent.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % AGENT_ICONS.length
  return AGENT_ICONS[idx]
}

export function normalizeSkillName(value: string): string {
  return value.toLowerCase().replace(/-/g, '_')
}

export function isSkillAssigned(agent: AgentItem, skillName: string): boolean {
  const norm = normalizeSkillName(skillName)
  return agent.skills.some((s) => normalizeSkillName(s) === norm || s === skillName)
}

export function getAgentSkillStats(agent: AgentItem, skills: SkillItem[]) {
  const specialized = skills.filter((s) => !s.isGlobal)
  const active = specialized.filter((s) => isSkillAssigned(agent, s.name)).length
  return { active, total: specialized.length || Math.max(active, 1) }
}

export function getAgentContextTokens(agent: AgentItem, skills: SkillItem[]): number {
  const assigned = skills.filter((s) => isSkillAssigned(agent, s.name))
  const skillTokens = assigned.reduce((sum, s) => sum + (s.totalTokens || 0), 0)
  return skillTokens + (agent.systemPromptTokens || 0)
}

export function getAgentFileLabel(filePath?: string, agentId?: string): string {
  if (filePath) {
    const normalized = filePath.replace(/\\/g, '/')
    const agentsIdx = normalized.lastIndexOf('/agents/')
    if (agentsIdx >= 0) return normalized.slice(agentsIdx + 1)
    const parts = normalized.split('/')
    if (parts.length >= 2) return `${parts[parts.length - 2]}/AGENT.md`
  }
  return agentId ? `${agentId}/AGENT.md` : 'AGENT.md'
}

export interface AgentYamlFields {
  id: string
  name: string
  department: string
  role: string
  description: string
  skills: string[]
  allowGlobalSkills: boolean
  model?: string
  inferenceParams?: InferenceParamsForm
}

export function buildAgentYamlPreview(fields: AgentYamlFields): string {
  const skillsYaml =
    fields.skills.length > 0
      ? `skills:\n${fields.skills.map((s) => `  - ${s}`).join('\n')}`
      : 'skills: []'

  const lines = [
    `id: ${fields.id}`,
    `name: "${fields.name.replace(/"/g, '\\"')}"`,
    `department: ${fields.department}`,
    `role: "${fields.role.replace(/"/g, '\\"')}"`,
    `description: "${fields.description.replace(/"/g, '\\"')}"`,
    skillsYaml,
    `allow_global_skills: ${fields.allowGlobalSkills}`,
  ]

  if (fields.model?.trim()) lines.push(`model: ${fields.model.trim()}`)

  const inferenceKeys: Array<keyof InferenceParamsForm> = [
    'temperature',
    'maxTokens',
    'topP',
    'topK',
    'frequencyPenalty',
    'presencePenalty',
  ]
  const inferenceLines: string[] = []
  for (const key of inferenceKeys) {
    const value = fields.inferenceParams?.[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      inferenceLines.push(`  ${key}: ${value}`)
    }
  }
  if (inferenceLines.length > 0) {
    lines.push('inference:')
    lines.push(...inferenceLines)
  }

  return lines.join('\n')
}

/** Rótulo do modelo no card/drawer: override explícito ou herança do worker do grupo. */
export function formatAgentModelLabel(
  agent: Pick<AgentItem, 'model' | 'effectiveModel'>,
  groupWorkerModel: string | undefined,
  labels: { inherited: string; unresolved: string },
): string {
  if (agent.model?.trim()) return agent.model.trim()
  const effective = agent.effectiveModel?.trim() || groupWorkerModel?.trim()
  if (effective) return labels.inherited.replace('{{model}}', effective)
  return labels.unresolved
}

export function isAgentModelInherited(agent: Pick<AgentItem, 'model'>): boolean {
  return !agent.model?.trim()
}

export function buildAgentMdPreview(fields: AgentYamlFields, systemPrompt: string): string {
  return `---\n${buildAgentYamlPreview(fields)}\n---\n\n${systemPrompt.trim()}`
}

export function getWeeklyLoadBars(agentId: string, baseLoad: number) {
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const
  let seed = agentId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)

  const bars = days.map((day) => {
    seed = (seed * 9301 + 49297) % 233280
    const ratio = 0.2 + (seed / 233280) * 0.8
    return { day, value: Math.max(1, Math.round(baseLoad * ratio)) }
  })

  const max = Math.max(...bars.map((b) => b.value), 1)
  const total = bars.reduce((sum, b) => sum + b.value, 0)
  return { bars, max, total }
}
