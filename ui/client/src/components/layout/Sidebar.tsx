import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  MessageSquare,
  BarChart3,
  Bot,
  Brain,
  Sparkles,
  Link2,
  Clock,
  Activity,
  ShieldAlert,
  Terminal,
  Sliders,
  Cpu,
  Database,
  Zap,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type ViewType =
  | 'chat'
  | 'agents'
  | 'soul'
  | 'skills'
  | 'mcps'
  | 'schedules'
  | 'runs'
  | 'usage'
  | 'logs'
  | 'models'
  | 'security'
  | 'config'
  | 'service'

interface NavGroup {
  titleKey: string
  items: { id: ViewType; labelKey: string; icon: React.ReactNode }[]
}

interface SidebarProps {
  isOpen: boolean
  isMobile: boolean
  activeView: ViewType
  onSelectView: (view: ViewType) => void
  onClose?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  isMobile,
  activeView,
  onSelectView,
  onClose,
}) => {
  const { t } = useTranslation('common')

  const navGroups: NavGroup[] = [
    {
      titleKey: 'navGroups.communication',
      items: [{ id: 'chat', labelKey: 'nav.chat', icon: <MessageSquare className="h-4 w-4" /> }],
    },
    {
      titleKey: 'navGroups.intelligence',
      items: [
        { id: 'agents', labelKey: 'nav.agents', icon: <Bot className="h-4 w-4" /> },
        { id: 'soul', labelKey: 'nav.soul', icon: <Brain className="h-4 w-4" /> },
        { id: 'skills', labelKey: 'nav.skills', icon: <Sparkles className="h-4 w-4" /> },
        { id: 'mcps', labelKey: 'nav.mcps', icon: <Link2 className="h-4 w-4" /> },
      ],
    },
    {
      titleKey: 'navGroups.automation',
      items: [
        { id: 'schedules', labelKey: 'nav.schedules', icon: <Clock className="h-4 w-4" /> },
        { id: 'runs', labelKey: 'nav.runs', icon: <Activity className="h-4 w-4" /> },
      ],
    },
    {
      titleKey: 'navGroups.governance',
      items: [
        { id: 'usage', labelKey: 'nav.usage', icon: <BarChart3 className="h-4 w-4" /> },
        { id: 'models', labelKey: 'nav.models', icon: <Database className="h-4 w-4" /> },
        { id: 'logs', labelKey: 'nav.logs', icon: <Terminal className="h-4 w-4" /> },
        { id: 'security', labelKey: 'nav.security', icon: <ShieldAlert className="h-4 w-4" /> },
        { id: 'config', labelKey: 'nav.config', icon: <Sliders className="h-4 w-4" /> },
        { id: 'service', labelKey: 'nav.service', icon: <Cpu className="h-4 w-4" /> },
      ],
    },
  ]

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-[var(--border-main)] bg-[var(--bg-sidebar)] transition-all duration-300 ease-out',
        'fixed inset-y-0 left-0 z-40 w-[var(--sidebar-width)] md:relative md:z-30 md:shrink-0',
        isOpen
          ? 'translate-x-0 md:w-[var(--sidebar-width)]'
          : '-translate-x-full md:w-0 md:translate-x-0 md:border-r-0 md:overflow-hidden'
      )}
    >
      <div className="flex h-[var(--topbar-height)] shrink-0 items-center justify-between border-b border-[var(--border-main)] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--accent)]">
            <Zap className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--text-main)]">{t('appName')}</div>
            <div className="truncate text-[11px] text-[var(--text-dim)]">{t('appSubtitle')}</div>
          </div>
        </div>
        {isMobile && isOpen && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-card-subtle)] md:hidden"
            aria-label={t('close')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto p-3 w-[var(--sidebar-width)]">
        {navGroups.map((group) => (
          <div key={group.titleKey} className="flex flex-col gap-1">
            <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
              {t(group.titleKey)}
            </div>
            {group.items.map((item) => {
              const isActive = activeView === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectView(item.id)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-card-subtle)] hover:text-[var(--text-main)]'
                  )}
                >
                  <span className={isActive ? 'text-[var(--nav-active-text)]' : 'text-[var(--text-dim)]'}>
                    {item.icon}
                  </span>
                  <span className="truncate">{t(item.labelKey)}</span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="flex shrink-0 items-center justify-between border-t border-[var(--border-main)] px-4 py-3 text-[11px] text-[var(--text-dim)] w-[var(--sidebar-width)]">
        <span className="font-mono">v2.0</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          online
        </span>
      </div>
    </aside>
  )
}
