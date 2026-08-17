import React from 'react'
import { FolderOpen } from 'lucide-react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title?: string
  description: string
  action?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <FolderOpen className="w-8 h-8 text-[var(--text-dim)]" />,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-[var(--border-main)] bg-[var(--bg-card-subtle)] my-4 space-y-3">
      <div className="p-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)] shadow-xs">
        {icon}
      </div>
      {title && (
        <h4 className="text-sm font-bold text-[var(--text-main)]">
          {title}
        </h4>
      )}
      <p className="text-xs text-[var(--text-muted)] max-w-sm font-medium leading-relaxed">
        {description}
      </p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  )
}
