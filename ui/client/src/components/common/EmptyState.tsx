import React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

interface EmptyStateProps {
  icon?: React.ReactNode
  title?: string
  description: string
  action?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        {icon && (
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--border-main)] bg-[var(--bg-card-subtle)] text-[var(--text-dim)]">
            {icon}
          </div>
        )}
        {title && <h4 className="mb-1 text-sm font-semibold text-[var(--text-main)]">{title}</h4>}
        <p className="max-w-sm text-sm text-[var(--text-muted)] leading-relaxed">{description}</p>
        {action && <div className="mt-4">{action}</div>}
      </CardContent>
    </Card>
  )
}
