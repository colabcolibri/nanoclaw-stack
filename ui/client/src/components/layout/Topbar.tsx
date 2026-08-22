import React from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, LogOut, Sun, Moon, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface TopbarProps {
  agentName?: string
  isOnline?: boolean
  isSidebarOpen: boolean
  onToggleSidebar: () => void
  onLogout: () => void
  currency?: 'BRL' | 'USD'
  onToggleCurrency?: (curr: 'BRL' | 'USD') => void
  showCurrency?: boolean
}

export const Topbar: React.FC<TopbarProps> = ({
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

  return (
    <header className="z-20 flex h-[var(--topbar-height)] shrink-0 items-center justify-between gap-4 border-b border-[var(--border-main)] bg-[var(--bg-topbar)] px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="shrink-0"
          title={isSidebarOpen ? 'Recolher menu' : 'Expandir menu'}
          aria-label={isSidebarOpen ? 'Recolher menu' : 'Expandir menu'}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </Button>

        <Badge variant={isOnline ? 'success' : 'secondary'} className="h-7 gap-1.5 px-2.5 text-xs">
          <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {agentName}
        </Badge>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {showCurrency && onToggleCurrency && (
          <div className="hidden items-center gap-0.5 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)] p-0.5 sm:flex">
            <Button
              variant={currency === 'BRL' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => onToggleCurrency('BRL')}
            >
              BRL
            </Button>
            <Button
              variant={currency === 'USD' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => onToggleCurrency('USD')}
            >
              USD
            </Button>
          </div>
        )}

        <Button variant="outline" size="icon" onClick={toggleTheme} className="h-8 w-8">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Button variant="outline" size="sm" onClick={toggleLanguage} className="h-8 gap-1 px-2 text-[11px]">
          <Globe className="h-3.5 w-3.5" />
          {currentLangLabel}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="h-8 gap-1 px-2 text-[var(--destructive)] hover:bg-red-500/10 hover:text-[var(--destructive)]"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden text-xs sm:inline">{t('logout')}</span>
        </Button>
      </div>
    </header>
  )
}
