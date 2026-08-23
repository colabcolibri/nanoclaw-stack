import React from 'react'
import { Settings, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type StatusVariant = 'success' | 'secondary' | 'destructive'

interface IntegrationCardProps {
  icon: LucideIcon
  iconClassName: string
  title: string
  description: string
  statusLabel: string
  statusVariant: StatusVariant
  onConfigure?: () => void
  configureLabel?: string
  primaryAction?: {
    label: string
    onClick: () => void
    variant?: 'default' | 'outline' | 'destructive'
  }
  secondaryAction?: {
    label: string
    onClick: () => void
    variant?: 'outline' | 'destructive'
  }
}

export const IntegrationCard: React.FC<IntegrationCardProps> = ({
  icon: Icon,
  iconClassName,
  title,
  description,
  statusLabel,
  statusVariant,
  onConfigure,
  configureLabel,
  primaryAction,
  secondaryAction,
}) => {
  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-(--border-main) bg-(--bg-card) p-5 transition-colors hover:bg-(--bg-card-subtle)/40">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
            iconClassName
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-snug text-(--text-main) wrap-break-word sm:text-base">
            {title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-(--text-muted) wrap-break-word">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-(--border-main)/60 pt-4">
        <Badge variant={statusVariant} className="max-w-full text-[10px] font-semibold">
          <span className="truncate">{statusLabel}</span>
        </Badge>
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap gap-2">
        {onConfigure && configureLabel && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onConfigure}
            className="h-8 shrink-0 gap-1.5 text-xs font-semibold"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>{configureLabel}</span>
          </Button>
        )}
        {primaryAction && (
          <Button
            type="button"
            variant={primaryAction.variant || 'default'}
            size="sm"
            onClick={primaryAction.onClick}
            className="h-8 shrink-0 text-xs font-semibold"
          >
            {primaryAction.label}
          </Button>
        )}
        {secondaryAction && (
          <Button
            type="button"
            variant={secondaryAction.variant || 'outline'}
            size="sm"
            onClick={secondaryAction.onClick}
            className="h-8 shrink-0 text-xs font-semibold"
          >
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </article>
  )
}
