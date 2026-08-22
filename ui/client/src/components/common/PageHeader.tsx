import React from 'react'
import { useTranslation } from 'react-i18next'
import { ViewType } from '@/components/layout/Sidebar'
import { VIEW_TITLE_KEYS } from '@/lib/view-titles'

interface PageHeaderProps {
  title?: string
  view?: ViewType
  subtitle?: string
  actions?: React.ReactNode
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, view, subtitle, actions }) => {
  const { t } = useTranslation('common')
  const resolvedTitle = title ?? (view ? t(VIEW_TITLE_KEYS[view]) : '')

  if (!resolvedTitle && !subtitle && !actions) return null

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        {resolvedTitle && (
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-main)] sm:text-2xl">
            {resolvedTitle}
          </h1>
        )}
        {subtitle && (
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
