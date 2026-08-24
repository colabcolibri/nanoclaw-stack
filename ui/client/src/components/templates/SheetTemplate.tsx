import React from 'react'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export type SheetTemplateSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'

const sizeClasses: Record<SheetTemplateSize, string> = {
  sm: 'max-w-sm sm:max-w-sm',
  md: 'max-w-md sm:max-w-md',
  lg: 'max-w-lg sm:max-w-lg',
  xl: 'max-w-xl sm:max-w-xl',
  '2xl': 'max-w-2xl sm:max-w-2xl',
  '3xl': 'max-w-3xl sm:max-w-3xl',
}

export interface SheetTemplateProps {
  open: boolean
  onClose: () => void
  size?: SheetTemplateSize
  className?: string
  bodyClassName?: string
  bodyScrollable?: boolean
  header?: React.ReactNode
  beforeBody?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
}

export const SheetTemplate: React.FC<SheetTemplateProps> = ({
  open,
  onClose,
  size = 'lg',
  className,
  bodyClassName,
  bodyScrollable = true,
  header,
  beforeBody,
  footer,
  children,
}) => {
  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent
        side="right"
        className={cn(
          'flex h-dvh max-h-dvh w-full flex-col gap-0 overflow-hidden border-l border-(--border-main) bg-(--bg-card)/95 p-0 backdrop-blur-xl',
          sizeClasses[size],
          className,
        )}
      >
        <div className="flex h-full min-w-0 flex-col">
          {header}
          {beforeBody}
          <div
            className={cn(
              'min-h-0 flex-1',
              bodyScrollable
                ? 'overflow-y-auto overflow-x-hidden px-6 py-6'
                : 'flex flex-col overflow-hidden',
              bodyClassName,
            )}
          >
            {children}
          </div>
          {footer}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export interface SheetTemplateHeaderProps {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  className?: string
}

export const SheetTemplateHeader: React.FC<SheetTemplateHeaderProps> = ({
  icon,
  title,
  description,
  className,
}) => {
  return (
    <SheetHeader
      className={cn(
        'shrink-0 space-y-0 border-b border-(--border-main) bg-(--bg-card-subtle)/50 px-6 pb-5 pt-6',
        className,
      )}
    >
      <div className={cn('flex items-start gap-4 pr-8', !icon && 'pr-8')}>
        {icon && (
          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-(--accent-border) bg-(--accent-subtle)">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <SheetTitle className="mb-1 text-lg leading-snug">{title}</SheetTitle>
          {description && (
            <SheetDescription className="text-xs leading-relaxed">
              {description}
            </SheetDescription>
          )}
        </div>
      </div>
    </SheetHeader>
  )
}

export interface SheetTemplateFooterProps {
  children: React.ReactNode
  className?: string
}

export const SheetTemplateFooter: React.FC<SheetTemplateFooterProps> = ({
  children,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-end gap-2 border-t border-(--border-main) px-4 py-4 sm:px-6',
        className,
      )}
    >
      {children}
    </div>
  )
}
