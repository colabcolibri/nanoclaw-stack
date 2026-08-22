import React from 'react'
import { cn } from '@/lib/utils'

export interface FilterChip {
  id: string
  label: string
  count?: number
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
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
            isActive
              ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]'
              : 'border border-[var(--border-main)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:bg-[var(--bg-card-subtle)] hover:text-[var(--text-main)]'
          )}
        >
          {chip.label}
          {chip.count !== undefined && (
            <span
              className={cn(
                'rounded-md px-1.5 py-0.5 text-[10px] font-mono',
                isActive ? 'bg-black/10' : 'bg-[var(--bg-card-subtle)]'
              )}
            >
              {chip.count}
            </span>
          )}
        </button>
      )
    })}
  </div>
)
