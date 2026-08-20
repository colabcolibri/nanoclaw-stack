import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  MessageSquare,
  BarChart3,
  Brain,
  Sparkles,
  Link2,
  Clock,
  Activity,
  ShieldAlert,
  Terminal,
  Sliders,
  Cpu,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type ViewType =
  | 'chat'
  | 'usage'
  | 'soul'
  | 'skills'
  | 'mcps'
  | 'schedules'
  | 'runs'
  | 'security'
  | 'logs'
  | 'config'
  | 'service'

interface SidebarProps {
  isOpen: boolean
  activeView: ViewType
  onSelectView: (view: ViewType) => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  activeView,
  onSelectView,
}) => {
  const { t } = useTranslation('common')

  const navItems: { id: ViewType; label: string; icon: React.ReactNode }[] = [
    { id: 'chat', label: t('nav.chat'), icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'usage', label: t('nav.usage'), icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'soul', label: t('nav.soul'), icon: <Brain className="w-4 h-4" /> },
    { id: 'skills', label: t('nav.skills'), icon: <Sparkles className="w-4 h-4" /> },
    { id: 'mcps', label: t('nav.mcps'), icon: <Link2 className="w-4 h-4" /> },
    { id: 'schedules', label: t('nav.schedules'), icon: <Clock className="w-4 h-4" /> },
    { id: 'runs', label: t('nav.runs'), icon: <Activity className="w-4 h-4" /> },
    { id: 'security', label: t('nav.security'), icon: <ShieldAlert className="w-4 h-4" /> },
    { id: 'logs', label: t('nav.logs'), icon: <Terminal className="w-4 h-4" /> },
    { id: 'config', label: t('nav.config'), icon: <Sliders className="w-4 h-4" /> },
    { id: 'service', label: t('nav.service'), icon: <Cpu className="w-4 h-4" /> },
  ]

  return (
    <aside
      className={cn(
        'bg-[var(--bg-sidebar)] border-r border-[var(--border-main)] flex flex-col shrink-0 transition-all duration-250 ease-in-out z-20',
        isOpen ? 'w-64' : 'w-0 border-r-0 overflow-hidden'
      )}
    >
      {/* Navigation List */}
      <div className="p-3 sm:p-4 flex flex-col gap-1 flex-1 overflow-y-auto w-64">
        <div className="text-[10px] font-mono font-bold tracking-wider text-[var(--text-dim)] uppercase px-3 py-2">
          Controle & Operações
        </div>

        {navItems.map((item) => {
          const isActive = activeView === item.id
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left cursor-pointer select-none',
                isActive
                  ? 'bg-sky-600 text-white font-bold shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-subtle)] border border-transparent'
              )}
            >
              <span className={cn(isActive ? 'text-white' : 'text-[var(--text-muted)]')}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>

      {/* Sidebar Footer */}
      <div className="p-3.5 border-t border-[var(--border-main)] bg-[var(--bg-card-subtle)] text-[11px] text-[var(--text-dim)] font-mono text-center w-64">
        NanoClaw Stack • v2.0
      </div>
    </aside>
  )
}
