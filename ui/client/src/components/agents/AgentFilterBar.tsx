import React from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

export interface AgentFilterChip {
  id: string
  label: string
}

interface AgentFilterBarProps {
  chips: AgentFilterChip[]
  selected: string
  onSelect: (id: string) => void
  searchQuery: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
}

export const AgentFilterBar: React.FC<AgentFilterBarProps> = ({
  chips,
  selected,
  onSelect,
  searchQuery,
  onSearchChange,
  searchPlaceholder,
}) => (
  <div className="flex w-full min-w-0 max-w-full flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
    <div className="min-w-0 w-full overflow-x-auto sm:flex-1 sm:overflow-visible">
      <div className="flex w-max flex-wrap gap-2 sm:w-auto">
      {chips.map((chip) => {
        const isActive = selected === chip.id
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onSelect(chip.id)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors',
              isActive
                ? 'border-(--accent-border) bg-(--accent-subtle) text-primary'
                : 'border-(--border-main) bg-(--bg-card-subtle) text-(--text-main) hover:bg-(--bg-card)'
            )}
          >
            {chip.label}
          </button>
        )
      })}
      </div>
    </div>

    <div className="relative w-full shrink-0 sm:w-64">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--text-dim)" />
      <Input
        type="search"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        className="h-10 rounded-lg border-(--border-main) bg-(--bg-card) pl-9 text-sm"
      />
    </div>
  </div>
)
