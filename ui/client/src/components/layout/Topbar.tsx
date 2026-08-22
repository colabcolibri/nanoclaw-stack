import React from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, LogOut, Sun, Moon, PanelLeftClose, PanelRightOpen, Zap } from 'lucide-react'
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
}

export const Topbar: React.FC<TopbarProps> = ({
  agentName = 'Barão',
  isOnline = true,
  isSidebarOpen,
  onToggleSidebar,
  onLogout,
  currency = 'BRL',
  onToggleCurrency,
}) => {
  const { t, i18n } = useTranslation('common')
  const { theme, toggleTheme } = useTheme()

  const toggleLanguage = () => {
    const nextLang = i18n.language.startsWith('en') ? 'pt' : 'en'
    i18n.changeLanguage(nextLang)
  }

  const currentLangLabel = i18n.language.startsWith('en') ? 'EN' : 'PT'

  return (
    <header className="h-16 border-b border-[var(--border-main)] bg-[var(--bg-topbar)] backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors">
      <div className="flex items-center gap-3">
        {/* Sidebar Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-subtle)]"
          title={isSidebarOpen ? 'Recolher barra lateral' : 'Expandir barra lateral'}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="w-5 h-5" />
          ) : (
            <PanelRightOpen className="w-5 h-5" />
          )}
        </Button>

        <div className="flex items-center gap-2 font-bold text-[var(--text-main)] text-base sm:text-lg tracking-tight">
          <span className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)] flex items-center justify-center shrink-0 shadow-xs">
            <Zap className="w-4 h-4" />
          </span>
          <span className="hidden xs:inline">{t('appName')}</span>
        </div>

        <Badge variant={isOnline ? 'success' : 'secondary'} className="gap-1.5 py-1 px-2.5">
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
          <span className="hidden sm:inline">{agentName} ({isOnline ? t('online') : t('offline')})</span>
          <span className="sm:hidden">{agentName}</span>
        </Badge>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Currency Switcher in Header (BRL / USD) */}
        {onToggleCurrency && (
          <div className="flex p-0.5 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-lg gap-0.5 shadow-xs">
            <Button
              variant={currency === 'BRL' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs px-2 font-bold cursor-pointer"
              onClick={() => onToggleCurrency('BRL')}
              title="Exibir todos os valores em Reais (BRL)"
            >
              🇧🇷 BRL
            </Button>
            <Button
              variant={currency === 'USD' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs px-2 font-bold cursor-pointer"
              onClick={() => onToggleCurrency('USD')}
              title="Exibir todos os valores em Dólar (USD)"
            >
              🇺🇸 USD
            </Button>
          </div>
        )}

        {/* Theme Toggle (Light / Dark) */}
        <Button
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          className="h-8 w-8 p-0 border-[var(--border-main)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-subtle)] cursor-pointer"
          title={theme === 'dark' ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-sky-600" />
          )}
        </Button>

        {/* Language Switcher */}
        <Button
          variant="outline"
          size="sm"
          onClick={toggleLanguage}
          className="h-8 gap-1.5 text-xs font-mono border-[var(--border-main)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-subtle)] cursor-pointer"
          title={t('language')}
        >
          <Globe className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>{currentLangLabel}</span>
        </Button>

        {/* Logout */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="h-8 gap-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 cursor-pointer"
          title={t('logout')}
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('logout')}</span>
        </Button>
      </div>
    </header>
  )
}
