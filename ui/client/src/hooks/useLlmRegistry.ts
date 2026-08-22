import { useState, useEffect, useCallback } from 'react'
import { ApiClient } from '@/api/client'
import type { ProviderMeta } from '@/lib/model-registry'

let cachedProviders: Record<string, ProviderMeta> | null = null
let cachePromise: Promise<Record<string, ProviderMeta>> | null = null

export function useLlmRegistry() {
  const [providers, setProviders] = useState<Record<string, ProviderMeta>>(cachedProviders || {})
  const [isLoading, setIsLoading] = useState(!cachedProviders)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await ApiClient.getLlmRegistry()
      cachedProviders = data.providers || {}
      setProviders(cachedProviders)
      return cachedProviders
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar modelos')
      return {}
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (cachedProviders) {
      setProviders(cachedProviders)
      setIsLoading(false)
      return
    }
    if (!cachePromise) {
      cachePromise = reload().finally(() => {
        cachePromise = null
      }) as Promise<Record<string, ProviderMeta>>
    } else {
      cachePromise.then((p) => setProviders(p))
    }
  }, [reload])

  return { providers, isLoading, error, reload }
}

export function invalidateLlmRegistryCache(): void {
  cachedProviders = null
}
