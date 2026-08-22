export interface ModelPricing {
  inputPerMillion: number
  outputPerMillion: number
  cacheWritePerMillion: number
  cacheHitPerMillion: number
  contextWindow: string
  savingsPct?: number
}

export interface ModelItem {
  id: string
  label: string
  recommended?: boolean
  recommendedRole?: 'orchestrator' | 'worker' | 'sender' | 'all'
  pricing: ModelPricing
}

export interface ProviderMeta {
  name: string
  defaultBaseUrl: string
  completionUrl?: string
  defaultModel: string
  keyEnvName?: string
  models: ModelItem[]
}

export interface LlmRegistryResponse {
  updatedAt: string
  providers: Record<string, ProviderMeta>
}

export function getAllModelsFromProviders(providers: Record<string, ProviderMeta>): ModelItem[] {
  return Object.values(providers).flatMap((p) => p.models)
}

export function findModelInProviders(
  providers: Record<string, ProviderMeta>,
  modelId: string
): ModelItem | undefined {
  return getAllModelsFromProviders(providers).find((m) => m.id === modelId)
}

/** Retorna o provider_id dono de um modelo no catálogo. */
export function findProviderForModel(
  providers: Record<string, ProviderMeta>,
  modelId: string
): string | undefined {
  for (const [providerId, meta] of Object.entries(providers)) {
    if (meta.models.some((m) => m.id === modelId)) return providerId
  }
  return undefined
}

/** Providers distintos usados por uma lista de model ids. */
export function providersForModels(
  providers: Record<string, ProviderMeta>,
  modelIds: string[]
): string[] {
  const set = new Set<string>()
  for (const id of modelIds) {
    const pid = findProviderForModel(providers, id)
    if (pid) set.add(pid)
  }
  return Array.from(set)
}
