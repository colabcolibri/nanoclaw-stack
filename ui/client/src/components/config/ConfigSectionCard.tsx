import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface ConfigSectionCardProps {
  title: string
  description?: string
  icon?: LucideIcon
  iconClassName?: string
  children: React.ReactNode
  className?: string
}

export const ConfigSectionCard: React.FC<ConfigSectionCardProps> = ({
  title,
  description,
  icon: Icon,
  iconClassName,
  children,
  className,
}) => (
  <Card className={cn('border-(--border-main) bg-(--bg-card) shadow-xs overflow-hidden', className)}>
    <CardHeader className="border-b border-(--border-main)/60 bg-(--bg-card-subtle)/40 px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        {Icon && (
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-(--border-main) bg-(--bg-card)',
              iconClassName,
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 space-y-0.5">
          <CardTitle className="text-base font-semibold text-(--text-main)">{title}</CardTitle>
          {description && (
            <CardDescription className="text-sm leading-relaxed text-(--text-muted)">
              {description}
            </CardDescription>
          )}
        </div>
      </div>
    </CardHeader>
    <CardContent className="p-4 sm:p-5">{children}</CardContent>
  </Card>
)
