import type { FilterChip } from '@/components/common/FilterChips'
import type { RunFilterKind, RunKindCounts } from '@/components/runs/unified-runs'

export interface RunFilterDefinition {
  id: RunFilterKind
  label: string
  activeClassName: string
}

export const RUN_FILTER_DEFINITIONS: RunFilterDefinition[] = [
  {
    id: 'all',
    label: 'Todos',
    activeClassName: 'bg-sky-600 text-white shadow-xs',
  },
  {
    id: 'cron',
    label: 'Crons periódicas',
    activeClassName: 'bg-purple-600 text-white shadow-xs',
  },
  {
    id: 'triage',
    label: 'Triagem',
    activeClassName: 'bg-indigo-600 text-white shadow-xs',
  },
  {
    id: 'supervisor',
    label: 'Supervisor',
    activeClassName: 'bg-violet-600 text-white shadow-xs',
  },
  {
    id: 'audit',
    label: 'Passos',
    activeClassName: 'bg-slate-600 text-white shadow-xs',
  },
  {
    id: 'tools',
    label: 'Ferramentas & ações',
    activeClassName: 'bg-blue-600 text-white shadow-xs',
  },
  {
    id: 'synthesis',
    label: 'Síntese persona',
    activeClassName: 'bg-emerald-600 text-white shadow-xs',
  },
  {
    id: 'memo',
    label: 'Memórias semânticas',
    activeClassName: 'bg-amber-600 text-white shadow-xs',
  },
]

export function buildRunFilterChips(counts: RunKindCounts): FilterChip[] {
  return RUN_FILTER_DEFINITIONS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    count: counts[definition.id],
    activeClassName: definition.activeClassName,
    inactiveClassName: 'bg-(--bg-input) text-(--text-muted) hover:text-(--text-main)',
  }))
}
