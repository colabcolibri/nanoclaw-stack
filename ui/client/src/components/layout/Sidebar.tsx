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
  items: { id: ViewType; labelKey: string; icon: React.ReactNode; badge?: string }[]
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
      items: [{ id: 'chat', labelKey: 'nav.chat', icon: <MessageSquare className="w-4 h-4" /> }],
    },
    {
      titleKey: 'navGroups.intelligence',
      items: [
        { id: 'agents', labelKey: 'nav.agents', icon: <Bot className="w-4 h-4" /> },
        { id: 'soul', labelKey: 'nav.soul', icon: <Brain className="w-4 h-4" /> },
        { id: 'skills', labelKey: 'nav.skills', icon: <Sparkles className="w-4 h-4" /> },
        { id: 'mcps', labelKey: 'nav.mcps', icon: <Link2 className="w-4 h-4" /> },
      ],
    },
    {
      titleKey: 'navGroups.automation',
      items: [
        { id: 'schedules', labelKey: 'nav.schedules', icon: <Clock className="w-4 h-4" /> },
        { id: 'runs', labelKey: 'nav.runs', icon: <Activity className="w-4 h-4" /> },
      ],
    },
    {
      titleKey: 'navGroups.governance',
      items: [
        { id: 'usage', labelKey: 'nav.usage', icon: <BarChart3 className="w-4 h-4" /> },
        { id: 'models', labelKey: 'nav.models', icon: <Database className="w-4 h-4" /> },
        { id: 'logs', labelKey: 'nav.logs', icon: <Terminal className="w-4 h-4" /> },
        { id: 'security', labelKey: 'nav.security', icon: <ShieldAlert className="w-4 h-4" /> },
        { id: 'config', labelKey: 'nav.config', icon: <Sliders className="w-4 h-4" /> },
        { id: 'service', labelKey: 'nav.service', icon: <Cpu className="w-4 h-4" /> },
      ],
    },
  ]

  return (
    <aside
      className={cn(
        'bg-[var(--bg-sidebar)] border-r border-[var(--border-main)] flex flex-col h-screen select-none transition-all duration-300 ease-out',
        'fixed inset-y-0 left-0 z-40 w-[17.5rem] md:relative md:z-30 md:shrink-0',
        isOpen
          ? 'translate-x-0 md:w-[17.5rem]'
          : '-translate-x-full md:translate-x-0 md:w-0 md:border-r-0 md:overflow-hidden'
      )}
    >
      <div className="h-14 border-b border-[var(--border-main)] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)] flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm tracking-tight text-[var(--text-main)] leading-none truncate">
              {t('appName')}
            </span>
            <span className="text-[10px] text-[var(--text-dim)] font-mono mt-0.5 truncate">
              {t('appSubtitle')}
            </span>
          </div>
        </div>

        {isMobile && isOpen && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-subtle)] md:hidden"
            aria-label={t('close')}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="p-3 flex flex-col gap-5 flex-1 overflow-y-auto w-[17.5rem]">
        {navGroups.map((group) => (
          <div key={group.titleKey} className="flex flex-col gap-0.5">
            <div className="text-[10px] font-semibold tracking-wider text-[var(--text-dim)] uppercase px-2.5 py-1.5">
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
                    'flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer',
                    isActive
                      ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-subtle)]'
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className={cn(isActive ? 'text-[var(--nav-active-text)]' : 'text-[var(--text-dim)]')}>
                      {item.icon}
                    </span>
                    <span className="truncate">{t(item.labelKey)}</span>
                  </div>

                  {item.badge && !isActive && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)] font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-[var(--border-main)] text-[11px] text-[var(--text-dim)] font-mono w-[17.5rem] shrink-0 flex items-center justify-between px-4">
        <span>NanoClaw v2.0</span>
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Sistema online" />
      </div>
    </aside>
  )
}
