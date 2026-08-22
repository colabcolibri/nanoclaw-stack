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
  Zap,
  PanelLeftClose,
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
  | 'security'
  | 'config'
  | 'service'

interface NavGroup {
  title: string
  items: { id: ViewType; label: string; icon: React.ReactNode; badge?: string }[]
}

interface SidebarProps {
  isOpen: boolean
  activeView: ViewType
  onSelectView: (view: ViewType) => void
  onToggleSidebar?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  activeView,
  onSelectView,
  onToggleSidebar,
}) => {
  const { t } = useTranslation('common')

  const navGroups: NavGroup[] = [
    {
      title: 'Comunicação',
      items: [
        { id: 'chat', label: t('nav.chat'), icon: <MessageSquare className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Inteligência & Agentes',
      items: [
        { id: 'agents', label: t('nav.agents'), icon: <Bot className="w-4 h-4" />, badge: 'Multi-Agent' },
        { id: 'soul', label: t('nav.soul'), icon: <Brain className="w-4 h-4" /> },
        { id: 'skills', label: t('nav.skills'), icon: <Sparkles className="w-4 h-4" /> },
        { id: 'mcps', label: t('nav.mcps'), icon: <Link2 className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Automação & Tarefas',
      items: [
        { id: 'schedules', label: t('nav.schedules'), icon: <Clock className="w-4 h-4" /> },
        { id: 'runs', label: t('nav.runs'), icon: <Activity className="w-4 h-4" /> },
      ],
    },
    {
      title: 'Governança & Sistema',
      items: [
        { id: 'usage', label: t('nav.usage'), icon: <BarChart3 className="w-4 h-4" /> },
        { id: 'logs', label: t('nav.logs'), icon: <Terminal className="w-4 h-4" /> },
        { id: 'security', label: t('nav.security'), icon: <ShieldAlert className="w-4 h-4" /> },
        { id: 'config', label: t('nav.config'), icon: <Sliders className="w-4 h-4" /> },
        { id: 'service', label: t('nav.service'), icon: <Cpu className="w-4 h-4" /> },
      ],
    },
  ]

  return (
    <aside
      className={cn(
        'bg-[var(--bg-sidebar)] border-r border-[var(--border-main)] flex flex-col shrink-0 transition-all duration-250 ease-in-out z-30 h-screen select-none',
        isOpen ? 'w-64' : 'w-0 border-r-0 overflow-hidden'
      )}
    >
      {/* Top Sidebar Header with Branding & Logo */}
      <div className="h-16 border-b border-[var(--border-main)] px-4 flex items-center justify-between shrink-0 bg-[var(--bg-sidebar)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)] flex items-center justify-center shrink-0 shadow-xs">
            <Zap className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-[var(--text-main)] leading-none">
              NanoClaw UAI
            </span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
              Multi-Agent Stack
            </span>
          </div>
        </div>

        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-subtle)] transition-colors"
            title="Recolher barra lateral"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation List Grouped */}
      <div className="p-3 sm:p-3.5 flex flex-col gap-4 flex-1 overflow-y-auto w-64">
        {navGroups.map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            <div className="text-[10px] font-mono font-bold tracking-wider text-[var(--text-dim)] uppercase px-2.5 py-1">
              {group.title}
            </div>

            {group.items.map((item) => {
              const isActive = activeView === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectView(item.id)}
                  className={cn(
                    'flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer select-none',
                    isActive
                      ? 'bg-sky-600 text-white font-bold shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-subtle)] border border-transparent'
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className={cn(isActive ? 'text-white' : 'text-[var(--text-muted)]')}>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && !isActive && (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-md bg-sky-500/10 text-sky-500 border border-sky-500/20 font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-[var(--border-main)] bg-[var(--bg-card-subtle)] text-[11px] text-[var(--text-dim)] font-mono text-center w-64 shrink-0 flex items-center justify-between px-4">
        <span>NanoClaw v2.0</span>
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Sistema Online" />
      </div>
    </aside>
  )
}
