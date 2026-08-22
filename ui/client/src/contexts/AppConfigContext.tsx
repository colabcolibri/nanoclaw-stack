import React, { createContext, useContext } from 'react'

export interface AppConfig {
  defaultGroupFolder: string
}

const AppConfigContext = createContext<AppConfig | null>(null)

export function AppConfigProvider({
  config,
  children,
}: {
  config: AppConfig
  children: React.ReactNode
}) {
  return <AppConfigContext.Provider value={config}>{children}</AppConfigContext.Provider>
}

export function useAppConfig(): AppConfig {
  const ctx = useContext(AppConfigContext)
  if (!ctx) {
    throw new Error('useAppConfig deve ser usado dentro de AppConfigProvider')
  }
  return ctx
}

export function useDefaultGroup(): string {
  return useAppConfig().defaultGroupFolder
}
