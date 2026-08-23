import React, { useState, useEffect } from 'react'
import { ApiClient, ChatMessage, SystemStats } from '@/api/client'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { Topbar } from '@/components/layout/Topbar'
import { Sidebar, ViewType } from '@/components/layout/Sidebar'
import { StatsGrid } from '@/components/layout/StatsGrid'
import { ContentArea, getViewContentWidth } from '@/components/layout/ContentArea'
import { ChatView } from '@/components/chat/ChatView'
import { SoulView } from '@/components/soul/SoulView'
import { AnalyticsView } from '@/components/analytics/AnalyticsView'
import { ConfigView } from '@/components/config/ConfigView'
import { SchedulesView } from '@/components/schedules/SchedulesView'
import { RunsView } from '@/components/runs/RunsView'
import { SecurityView } from '@/components/security/SecurityView'
import { LogsView } from '@/components/logs/LogsView'
import { SkillsView } from '@/components/skills/SkillsView'
import { AgentsView } from '@/components/agents/AgentsView'
import { McpsView } from '@/components/mcps/McpsView'
import { ModelsView } from '@/components/models/ModelsView'
import { ServiceView } from '@/components/service/ServiceView'
import { InspectorSheet } from '@/components/chat/InspectorSheet'
import { AppConfigProvider } from '@/contexts/AppConfigContext'
import { AuthView } from '@/components/auth/AuthView'

const VALID_VIEWS: ViewType[] = [
  'chat',
  'usage',
  'agents',
  'soul',
  'skills',
  'mcps',
  'schedules',
  'runs',
  'security',
  'logs',
  'models',
  'config',
  'service',
]

const STATS_VIEWS: ViewType[] = ['usage']

function getInitialView(): ViewType {
  const hash = window.location.hash.replace('#', '') as ViewType
  if (VALID_VIEWS.includes(hash)) return hash
  const saved = localStorage.getItem('nanoclaw_active_tab') as ViewType
  if (VALID_VIEWS.includes(saved)) return saved
  return 'chat'
}

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [appConfig, setAppConfig] = useState<{ defaultGroupFolder: string } | null>(null)
  const [currency, setCurrency] = useState<'BRL' | 'USD'>('BRL')
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('nanoclaw_sidebar_state')
    if (saved === 'open') return true
    if (saved === 'closed') return false
    return window.innerWidth >= 768
  })

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches)
      if (e.matches) setIsSidebarOpen(false)
    }
    handler(mq)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev
      localStorage.setItem('nanoclaw_sidebar_state', next ? 'open' : 'closed')
      return next
    })
  }

  const [activeView, setActiveView] = useState<ViewType>(getInitialView)

  const handleSelectView = (view: ViewType) => {
    setActiveView(view)
    localStorage.setItem('nanoclaw_active_tab', view)
    window.location.hash = view
    if (isMobile) setIsSidebarOpen(false)
  }

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as ViewType
      if (VALID_VIEWS.includes(hash)) {
        setActiveView(hash)
        localStorage.setItem('nanoclaw_active_tab', hash)
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const [stats, setStats] = useState<SystemStats | null>(null)
  const [inspectedMessage, setInspectedMessage] = useState<ChatMessage | null>(null)
  const [isInspectorOpen, setIsInspectorOpen] = useState(false)

  useEffect(() => {
    checkAuthentication()
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      loadInitialData()
      const interval = setInterval(loadInitialData, 10000)
      return () => clearInterval(interval)
    }
  }, [isAuthenticated])

  const checkAuthentication = async () => {
    const res = await ApiClient.checkAuth()
    setIsAuthenticated(res.authenticated)
    if (res.authenticated) {
      const cfg = await ApiClient.getAppConfig()
      setAppConfig({ defaultGroupFolder: cfg.defaultGroupFolder })
    }
  }

  const loadInitialData = async () => {
    try {
      const [statsData, serviceData] = await Promise.all([
        ApiClient.getStats(),
        ApiClient.getServiceStatus().catch(() => ({ active: true, statusText: 'Online', mainPid: 0 })),
      ])

      const isActive = serviceData?.active ?? true
      const pidStr = serviceData?.mainPid ? String(serviceData.mainPid) : '--'

      setStats({
        totalMessages: statsData.totalMessages || 0,
        totalInbound: statsData.totalInbound || 0,
        totalOutbound: statsData.totalOutbound || 0,
        estimatedTokens: statsData.estimatedTokens || 0,
        totalTokens: statsData.totalTokens,
        promptTokens: statsData.promptTokens,
        cacheHitTokens: statsData.cacheHitTokens,
        cacheMissTokens: statsData.cacheMissTokens,
        completionTokens: statsData.completionTokens,
        cacheHitRatio: statsData.cacheHitRatio,
        totalApiCalls: statsData.totalApiCalls,
        totalRuns: statsData.totalRuns,
        usdToBrlRate: statsData.usdToBrlRate,
        estimatedCostUsd: statsData.estimatedCostUsd || '0.00',
        estimatedCostBrl: statsData.estimatedCostBrl || '0.00',
        serviceStatus: isActive ? 'Online' : 'Offline',
        servicePid: pidStr,
        agentName: statsData.agentName || 'Barão',
        modelName: statsData.modelName,
      })
    } catch (err: any) {
      if (err.message === 'UNAUTHORIZED') {
        setIsAuthenticated(false)
      }
    }
  }

  const handleLogout = async () => {
    try {
      await ApiClient.logout()
    } catch {}
    setIsAuthenticated(false)
  }

  const handleInspectMessage = (msg: ChatMessage) => {
    setInspectedMessage(msg)
    setIsInspectorOpen(true)
  }

  const showStats = STATS_VIEWS.includes(activeView)
  const showCurrency = activeView === 'chat' || activeView === 'usage'

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-(--bg-page) flex items-center justify-center text-(--text-muted) font-mono text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-(--accent) animate-ping" />
          <span>Carregando painel NanoClaw...</span>
        </div>
      </div>
    )
  }

  if (isAuthenticated === false) {
    return <AuthView onLoginSuccess={() => checkAuthentication()} />
  }

  if (!appConfig) {
    return (
      <div className="min-h-screen bg-(--bg-page) flex items-center justify-center text-(--text-muted) font-mono text-xs">
        Carregando configuração...
      </div>
    )
  }

  return (
    <AppConfigProvider config={appConfig}>
    <div className="h-screen w-screen overflow-hidden bg-(--bg-page) text-(--text-main) flex flex-row">
      {isSidebarOpen && isMobile && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-(--bg-overlay) backdrop-blur-[2px] md:hidden"
          onClick={toggleSidebar}
        />
      )}

      <Sidebar
        isOpen={isSidebarOpen}
        isMobile={isMobile}
        activeView={activeView}
        onSelectView={handleSelectView}
        onClose={toggleSidebar}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Topbar
          agentName={stats?.agentName || 'Barão'}
          isOnline={stats?.serviceStatus === 'Online'}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={toggleSidebar}
          onLogout={handleLogout}
          currency={currency}
          onToggleCurrency={setCurrency}
          showCurrency={showCurrency}
        />

        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full min-w-0 max-w-(--content-max) flex-col gap-6 p-4 sm:p-6 lg:p-8">
            {showStats && <StatsGrid stats={stats} currency={currency} />}

            <ContentArea width={getViewContentWidth(activeView)} className="gap-5">
              {activeView === 'chat' && (
                <ChatView
                  stats={stats}
                  currency={currency}
                  onInspectMessage={handleInspectMessage}
                />
              )}

              {activeView === 'usage' && <AnalyticsView currency={currency} />}
              {activeView === 'agents' && <AgentsView />}
              {activeView === 'soul' && <SoulView />}
              {activeView === 'skills' && <SkillsView />}
              {activeView === 'mcps' && <McpsView />}
              {activeView === 'schedules' && <SchedulesView />}
              {activeView === 'runs' && <RunsView />}
              {activeView === 'security' && <SecurityView />}
              {activeView === 'models' && <ModelsView />}
              {activeView === 'logs' && <LogsView />}
              {activeView === 'config' && <ConfigView />}
              {activeView === 'service' && <ServiceView />}
            </ContentArea>
          </div>
        </main>
      </div>

      <InspectorSheet
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        message={inspectedMessage}
      />
    </div>
    </AppConfigProvider>
  )
}

export function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

export default App
