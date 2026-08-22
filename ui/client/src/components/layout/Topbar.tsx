import React from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, LogOut, Sun, Moon, PanelLeftClose, PanelRightOpen } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ViewType } from '@/components/layout/Sidebar'

interface TopbarProps {
  activeView: ViewType
  agentName?: string
  isOnline?: boolean
  isSidebarOpen: boolean
  onToggleSidebar: () => void
  onLogout: () => void
  currency?: 'BRL' | 'USD'
  onToggleCurrency?: (curr: 'BRL' | 'USD') => void
  showCurrency?: boolean
}

const VIEW_TITLE_KEYS: Record<ViewType, string> = {
  chat: 'nav.chat',
  usage: 'nav.usage',
  agents: 'nav.agents',
  soul: 'nav.soul',
  skills: 'nav.skills',
  mcps: 'nav.mcps',
  schedules: 'nav.schedules',
  runs: 'nav.runs',
  security: 'nav.security',
  logs: 'nav.logs',
  models: 'nav.models',
  config: 'nav.config',
  service: 'nav.service',
}

export const Topbar: React.FC<TopbarProps> = ({
  activeView,
  agentName = 'Barão',
  isOnline = true,
  isSidebarOpen,
  onToggleSidebar,
  onLogout,
  currency = 'BRL',
  onToggleCurrency,
  showCurrency = false,
}) => {
  const { t, i18n } = useTranslation('common')
  const { theme, toggleTheme } = useTheme()

  const toggleLanguage = () => {
    const nextLang = i18n.language.startsWith('en') ? 'pt' : 'en'
    i18n.changeLanguage(nextLang)
  }

  const currentLangLabel = i18n.language.startsWith('en') ? 'EN' : 'PT'
  const pageTitle = t(VIEW_TITLE_KEYS[activeView])

  return (
    <header className="h-14 border-b border-[var(--border-main)] bg-[var(--bg-topbar)] backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-subtle)] shrink-0"
          title={isSidebarOpen ? 'Recolher menu' : 'Abrir menu'}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="w-5 h-5" />
          ) : (
            <PanelRightOpen className="w-5 h-5" />
          )}
        </Button>

        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-[var(--text-main)] tracking-tight truncate">
            {pageTitle}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant={isOnline ? 'success' : 'secondary'} className="gap-1 py-0 px-2 text-[10px] h-5">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <span className="truncate max-w-[120px] sm:max-w-none">{agentName}</span>
            </Badge>
            <span className="text-[10px] text-[var(--text-dim)] hidden sm:inline">
              {isOnline ? t('online') : t('offline')}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {showCurrency && onToggleCurrency && (
          <div className="hidden sm:flex p-0.5 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg gap-0.5">
            <Button
              variant={currency === 'BRL' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-[11px] px-2 font-bold"
              onClick={() => onToggleCurrency('BRL')}
            >
              BRL
            </Button>
            <Button
              variant={currency === 'USD' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-[11px] px-2 font-bold"
              onClick={() => onToggleCurrency('USD')}
            >
              USD
            </Button>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          className="h-8 w-8 p-0 border-[var(--border-main)] bg-[var(--bg-card)]"
          title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-[var(--accent)]" />
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={toggleLanguage}
          className="h-8 gap-1 text-[11px] font-mono border-[var(--border-main)] bg-[var(--bg-card)] px-2"
          title={t('language')}
        >
          <Globe className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="hidden xs:inline">{currentLangLabel}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="h-8 w-8 sm:w-auto sm:px-2.5 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
          title={t('logout')}
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-xs">{t('logout')}</span>
        </Button>
      </div>
    </header>
  )
}
