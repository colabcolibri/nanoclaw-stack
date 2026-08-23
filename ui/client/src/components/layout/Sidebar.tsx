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
  separatorBefore?: boolean
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
  const isCollapsed = !isOpen && !isMobile

  const navGroups: NavGroup[] = [
    {
      titleKey: 'navGroups.communication',
      items: [{ id: 'chat', labelKey: 'nav.chat', icon: <MessageSquare className="h-4 w-4" /> }],
    },
    {
      titleKey: 'navGroups.intelligence',
      items: [
        { id: 'soul', labelKey: 'nav.soul', icon: <Brain className="h-4 w-4" /> },
        { id: 'agents', labelKey: 'nav.agents', icon: <Bot className="h-4 w-4" /> },
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
      titleKey: 'navGroups.models',
      items: [
        { id: 'models', labelKey: 'nav.models', icon: <Database className="h-4 w-4" /> },
        { id: 'config', labelKey: 'nav.config', icon: <Sliders className="h-4 w-4" /> },
      ],
    },
    {
      titleKey: 'navGroups.monitoring',
      items: [
        { id: 'usage', labelKey: 'nav.usage', icon: <BarChart3 className="h-4 w-4" /> },
        { id: 'logs', labelKey: 'nav.logs', icon: <Terminal className="h-4 w-4" /> },
      ],
    },
    {
      titleKey: 'navGroups.governance',
      separatorBefore: true,
      items: [{ id: 'security', labelKey: 'nav.security', icon: <ShieldAlert className="h-4 w-4" /> }],
    },
    {
      titleKey: 'navGroups.system',
      items: [{ id: 'service', labelKey: 'nav.service', icon: <Cpu className="h-4 w-4" /> }],
    },
  ]

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-(--border-main) bg-(--bg-sidebar) transition-all duration-300 ease-out md:relative md:z-30 md:shrink-0',
        isMobile
          ? isOpen
            ? 'w-(--sidebar-width) translate-x-0'
            : 'w-(--sidebar-width) -translate-x-full'
          : isOpen
            ? 'w-(--sidebar-width) translate-x-0'
            : 'w-(--sidebar-width-collapsed) translate-x-0'
      )}
    >
      <div
        className={cn(
          'flex h-(--topbar-height) shrink-0 items-center border-b border-(--border-main)',
          isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
        )}
      >
        <div className={cn('flex min-w-0 items-center', isCollapsed ? 'justify-center' : 'gap-3')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-(--accent-border) bg-(--accent-subtle) text-primary">
            <Zap className="h-4 w-4" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-(--text-main)">{t('appName')}</div>
              <div className="truncate text-[11px] text-(--text-dim)">{t('appSubtitle')}</div>
            </div>
          )}
        </div>
        {isMobile && isOpen && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-(--text-muted) hover:bg-(--bg-card-subtle) md:hidden"
            aria-label={t('close')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav
        className={cn(
          'flex flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden p-2',
          isCollapsed ? 'items-center' : 'gap-6 p-3'
        )}
      >
        {navGroups.map((group) => (
          <div
            key={group.titleKey}
            className={cn(
              'flex w-full flex-col gap-1',
              isCollapsed && 'items-center',
              group.separatorBefore && 'border-t border-(--border-main) pt-3',
            )}
          >
            {!isCollapsed && (
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-(--text-dim)">
                {t(group.titleKey)}
              </div>
            )}
            {group.items.map((item) => {
              const isActive = activeView === item.id
              const label = t(item.labelKey)
              return (
                <button
                  key={item.id}
                  type="button"
                  title={isCollapsed ? label : undefined}
                  aria-label={label}
                  onClick={() => onSelectView(item.id)}
                  className={cn(
                    'flex items-center rounded-lg text-sm font-medium transition-colors',
                    isCollapsed
                      ? 'h-9 w-9 justify-center'
                      : 'w-full gap-2.5 px-2.5 py-2 text-left',
                    isActive
                      ? 'bg-(--nav-active-bg) text-(--nav-active-text)'
                      : 'text-(--text-muted) hover:bg-(--bg-card-subtle) hover:text-(--text-main)'
                  )}
                >
                  <span
                    className={cn(
                      'shrink-0',
                      isActive ? 'text-(--nav-active-text)' : 'text-(--text-dim)'
                    )}
                  >
                    {item.icon}
                  </span>
                  {!isCollapsed && <span className="truncate">{label}</span>}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div
        className={cn(
          'flex shrink-0 items-center border-t border-(--border-main) py-3 text-[11px] text-(--text-dim)',
          isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
        )}
      >
        {!isCollapsed && <span className="font-mono">v2.0</span>}
        <span className="flex items-center gap-1.5" title="Sistema online">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {!isCollapsed && <span>online</span>}
        </span>
      </div>
    </aside>
  )
}
