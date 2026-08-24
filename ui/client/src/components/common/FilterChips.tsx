import React from 'react'
import { cn } from '@/lib/utils'
import { formatCount } from '@/lib/format-count'

export interface FilterChip {
  id: string
  label: string
  count?: number
  activeClassName?: string
  inactiveClassName?: string
}

interface FilterChipsProps {
  chips: FilterChip[]
  selected: string
  onSelect: (id: string) => void
  className?: string
}

export const FilterChips: React.FC<FilterChipsProps> = ({
  chips,
  selected,
  onSelect,
  className,
}) => (
  <div className={cn('flex flex-wrap gap-2', className)}>
    {chips.map((chip) => {
      const isActive = selected === chip.id
      return (
        <button
          key={chip.id}
          type="button"
          onClick={() => onSelect(chip.id)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
            isActive
              ? chip.activeClassName || 'bg-(--nav-active-bg) text-(--nav-active-text)'
              : chip.inactiveClassName ||
                  'border border-(--border-main) bg-(--bg-card) text-(--text-muted) hover:bg-(--bg-card-subtle) hover:text-(--text-main)'
          )}
        >
          {chip.label}
          {chip.count !== undefined && (
            <span
              className={cn(
                'rounded-md px-1.5 py-0.5 text-[10px] font-mono tabular-nums',
                isActive ? 'bg-black/10' : 'bg-(--bg-card-subtle)'
              )}
            >
              {formatCount(chip.count)}
            </span>
          )}
        </button>
      )
    })}
  </div>
)
