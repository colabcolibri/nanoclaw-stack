import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Check,
  Database,
  KeyRound,
  RefreshCw,
} from 'lucide-react'
import { ApiClient } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchInput } from '@/components/common/SearchInput'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useLlmRegistry, invalidateLlmRegistryCache } from '@/hooks/useLlmRegistry'
import type { ModelItem } from '@/lib/model-registry'
import { cn } from '@/lib/utils'

const ROLE_LABELS: Record<string, string> = {
  orchestrator: 'Orquestrador',
  worker: 'Worker',
  sender: 'Sender',
  memo: 'Memo',
  all: 'Todos',
}

function formatUsdPerMillion(value: number): string {
  if (!value) return '—'
  return `$${value.toFixed(3)}`
}

type EnrichedModel = ModelItem & { providerId: string; providerName: string }

export const ModelsView: React.FC = () => {
  const { providers, isLoading, reload } = useLlmRegistry()
  const [selectedProvider, setSelectedProvider] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [keysStatus, setKeysStatus] = useState<Record<string, { hasKey: boolean; masked: string }>>({})
  const [newApiKeys, setNewApiKeys] = useState<Record<string, string>>({})
  const [savingKeyFor, setSavingKeyFor] = useState<string | null>(null)

  const providerEntries = Object.entries(providers)

  const showToast = (text: string, type: 'success' | 'error') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadKeysStatus = async () => {
    try {
      const data = await ApiClient.getLlmKeysStatus()
      setKeysStatus(data.keysStatus ?? {})
    } catch {
      // status opcional
    }
  }

  useEffect(() => {
    loadKeysStatus()
  }, [])

  const refreshRegistry = async () => {
    invalidateLlmRegistryCache()
    await reload()
    await loadKeysStatus()
  }

  const handleSaveProviderKey = async (providerId: string) => {
    const key = newApiKeys[providerId]?.trim()
    if (!key) return
    setSavingKeyFor(providerId)
    try {
      const res = await ApiClient.saveProviderApiKey(providerId, key)
      setKeysStatus(res.keysStatus ?? {})
      setNewApiKeys((prev) => ({ ...prev, [providerId]: '' }))
      showToast(`Chave de ${providers[providerId]?.name ?? providerId} salva.`, 'success')
    } catch {
      showToast('Erro ao salvar API key.', 'error')
    } finally {
      setSavingKeyFor(null)
    }
  }

  const allModels = useMemo<EnrichedModel[]>(
    () =>
      providerEntries.flatMap(([pid, meta]) =>
        meta.models.map((m) => ({ ...m, providerId: pid, providerName: meta.name }))
      ),
    [providerEntries]
  )

  const configuredProviders = useMemo(
    () => providerEntries.filter(([id]) => keysStatus[id]?.hasKey).length,
    [providerEntries, keysStatus]
  )

  const filteredModels = useMemo(() => {
    const q = search.toLowerCase()
    return allModels.filter((m) => {
      const matchProvider = selectedProvider === 'all' || m.providerId === selectedProvider
      const matchSearch =
        !q ||
        m.id.toLowerCase().includes(q) ||
        m.label.toLowerCase().includes(q) ||
        m.providerName.toLowerCase().includes(q)
      return matchProvider && matchSearch
    })
  }, [allModels, selectedProvider, search])

  const showProviderColumn = selectedProvider === 'all'

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-5">
      {toast && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold animate-in fade-in',
            toast.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-900 dark:text-emerald-300'
              : 'border-red-500/30 bg-red-500/15 text-red-900 dark:text-red-300'
          )}
        >
          {toast.type === 'success' ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      <PageHeader
        view="models"
        subtitle="Catálogo versionado em código. Gerencie credenciais dos providers."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refreshRegistry}
            disabled={isLoading}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            Atualizar
          </Button>
        }
      />

      <Tabs defaultValue="catalog" className="w-full min-w-0">
        <TabsList>
          <TabsTrigger value="catalog">Catálogo ({allModels.length})</TabsTrigger>
          <TabsTrigger value="credentials">
            Credenciais ({configuredProviders}/{providerEntries.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar modelo..."
              className="w-full sm:max-w-sm"
            />
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger className="w-full sm:w-52 text-xs">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os providers</SelectItem>
                {providerEntries.map(([id, meta]) => (
                  <SelectItem key={id} value={id}>
                    {meta.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <Skeleton className="h-72 rounded-xl" />
          ) : filteredModels.length === 0 ? (
            <EmptyState
              icon={<Database className="h-8 w-8 text-(--text-dim)" />}
              title="Nenhum modelo encontrado"
              description="Ajuste os filtros ou atualize o catálogo."
            />
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-(--bg-input)/40 hover:bg-(--bg-input)/40">
                      <TableHead>Modelo</TableHead>
                      {showProviderColumn && <TableHead>Provider</TableHead>}
                      <TableHead>Sugestão</TableHead>
                      <TableHead>Contexto</TableHead>
                      <TableHead className="text-right">In/M</TableHead>
                      <TableHead className="text-right">Out/M</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">Cache W</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">Cache H</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredModels.map((m) => (
                      <TableRow key={`${m.providerId}:${m.id}`}>
                        <TableCell className="min-w-44 max-w-xs">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="truncate font-medium">{m.label}</span>
                              {m.recommended && (
                                <Badge variant="default" className="shrink-0 text-[9px] px-1.5 py-0">
                                  recomendado
                                </Badge>
                              )}
                            </div>
                            <span className="truncate font-mono text-[10px] text-(--text-dim)">
                              {m.id}
                            </span>
                          </div>
                        </TableCell>
                        {showProviderColumn && (
                          <TableCell className="text-(--text-muted) max-w-32 truncate">
                            {m.providerName}
                          </TableCell>
                        )}
                        <TableCell>
                          {m.recommendedRole ? (
                            <span className="text-xs text-(--text-muted)">
                              {ROLE_LABELS[m.recommendedRole] ?? m.recommendedRole}
                              <span className="text-(--text-dim)"> · padrão</span>
                            </span>
                          ) : (
                            <span className="text-(--text-dim)">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-(--text-muted)">
                          {m.pricing.contextWindow || '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-(--text-muted)">
                          {formatUsdPerMillion(m.pricing.inputPerMillion)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-(--text-muted)">
                          {formatUsdPerMillion(m.pricing.outputPerMillion)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-(--text-muted) hidden lg:table-cell">
                          {formatUsdPerMillion(m.pricing.cacheWritePerMillion)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-(--text-muted) hidden lg:table-cell">
                          {formatUsdPerMillion(m.pricing.cacheHitPerMillion)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <p className="text-[11px] leading-relaxed text-(--text-muted)">
            Preços em USD por 1M tokens. A coluna sugestão indica o papel padrão do catálogo quando a config do grupo
            está vazia — o que você define em Configurações sempre ganha. Para alterar modelos ou sugestões, edite{' '}
            <code className="rounded bg-(--bg-input) px-1 py-0.5 font-mono text-[10px]">
              nanoclaw/src/llm/catalog.ts
            </code>
            .
          </p>
        </TabsContent>

        <TabsContent value="credentials" className="space-y-4">
          <p className="text-xs text-(--text-muted)">
            API keys por provider. O catálogo de modelos é definido no código, não aqui.
          </p>

          {isLoading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-(--bg-input)/40 hover:bg-(--bg-input)/40">
                      <TableHead>Provider</TableHead>
                      <TableHead>Env var</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Chave atual</TableHead>
                      <TableHead className="min-w-56">Nova API key</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providerEntries.map(([id, meta]) => {
                      const status = keysStatus[id]
                      const hasKey = status?.hasKey ?? false
                      return (
                        <TableRow key={id}>
                          <TableCell className="font-medium max-w-40 truncate">
                            {meta.name}
                          </TableCell>
                          <TableCell className="font-mono text-[10px] text-(--text-dim) max-w-36 truncate">
                            {meta.keyEnvName ?? id}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={hasKey ? 'success' : 'outline'}
                              className="text-[10px] font-semibold"
                            >
                              {hasKey ? 'OK' : 'Ausente'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-[10px] text-(--text-muted) max-w-32 truncate">
                            {hasKey && status?.masked ? status.masked : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex min-w-0 gap-2">
                              <Input
                                type="password"
                                placeholder="sk-..."
                                value={newApiKeys[id] ?? ''}
                                onChange={(e) =>
                                  setNewApiKeys((prev) => ({ ...prev, [id]: e.target.value }))
                                }
                                className="min-w-0 h-8 font-mono text-xs"
                              />
                              <Button
                                type="button"
                                size="sm"
                                disabled={!newApiKeys[id]?.trim() || savingKeyFor === id}
                                onClick={() => handleSaveProviderKey(id)}
                                className="h-8 shrink-0 text-xs"
                              >
                                {savingKeyFor === id ? '...' : 'Salvar'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
