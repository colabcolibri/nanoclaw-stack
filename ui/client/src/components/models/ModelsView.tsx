import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Coins,
  Database,
  KeyRound,
  RefreshCw,
  Server,
} from 'lucide-react'
import { ApiClient } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchInput } from '@/components/common/SearchInput'
import { EmptyState } from '@/components/common/EmptyState'
import { ProviderCredentialCard } from '@/components/models/ProviderCredentialCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
import { cn } from '@/lib/utils'

const ROLE_LABELS: Record<string, string> = {
  orchestrator: 'Orquestrador',
  worker: 'Worker',
  sender: 'Sender',
  all: 'Todos',
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: React.ElementType
}) {
  return (
    <div className="min-w-0 rounded-xl border border-(--border-main) bg-(--bg-card) p-4">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-(--text-dim)">
        <Icon className="h-3.5 w-3.5 text-(--accent)" />
        <span className="truncate">{label}</span>
      </div>
      <p className="font-mono text-lg font-semibold text-(--text-main)">{value}</p>
    </div>
  )
}

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
      // status opcional — não bloqueia a tela
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

  const allModels = useMemo(
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

  const missingKeyProviders = providerEntries.length - configuredProviders

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

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-6">
      {toast && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl border p-3.5 text-xs font-semibold animate-in fade-in',
            toast.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-900 dark:text-emerald-300'
              : 'border-red-500/30 bg-red-500/15 text-red-900 dark:text-red-300'
          )}
        >
          {toast.type === 'success' ? (
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      <PageHeader
        view="models"
        subtitle="Catálogo versionado no código. Aqui você gerencia credenciais dos providers."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refreshRegistry}
            disabled={isLoading}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            Atualizar
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-22 rounded-xl" />
          ))
        ) : (
          <>
            <StatCard label="Total de modelos" value={allModels.length} icon={Database} />
            <StatCard label="Providers configurados" value={configuredProviders} icon={CheckCircle2} />
            <StatCard label="Sem chave" value={missingKeyProviders} icon={KeyRound} />
            <StatCard label="No catálogo" value={providerEntries.length} icon={Server} />
          </>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-(--text-main)">Credenciais por provider</h2>
          <p className="mt-0.5 text-xs text-(--text-muted)">
            Configure API keys para cada provider do catálogo. O catálogo em si é definido no código.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-xl" />
              ))
            : providerEntries.map(([id, meta]) => {
                const status = keysStatus[id]
                return (
                  <ProviderCredentialCard
                    key={id}
                    providerId={id}
                    name={meta.name}
                    envName={meta.keyEnvName ?? id}
                    hasKey={status?.hasKey ?? false}
                    maskedKey={status?.masked}
                    newKeyValue={newApiKeys[id] ?? ''}
                    onNewKeyChange={(value) =>
                      setNewApiKeys((prev) => ({ ...prev, [id]: value }))
                    }
                    onSave={() => handleSaveProviderKey(id)}
                    isSaving={savingKeyFor === id}
                  />
                )
              })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-(--text-main)">Modelos disponíveis</h2>
            <p className="mt-0.5 text-xs text-(--text-muted)">
              {filteredModels.length} modelo{filteredModels.length !== 1 ? 's' : ''} no catálogo
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger className="w-full sm:w-48 text-xs">
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
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar modelo..."
              className="w-full sm:max-w-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedProvider('all')}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
              selectedProvider === 'all'
                ? 'border-(--accent-border) bg-(--accent-subtle) text-(--accent)'
                : 'border-(--border-main) bg-(--bg-card) text-(--text-muted) hover:text-(--text-main)'
            )}
          >
            Todos
          </button>
          {providerEntries.map(([id, meta]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedProvider(id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                selectedProvider === id
                  ? 'border-(--accent-border) bg-(--accent-subtle) text-(--accent)'
                  : 'border-(--border-main) bg-(--bg-card) text-(--text-muted) hover:text-(--text-main)'
              )}
            >
              {meta.name}
            </button>
          ))}
        </div>

        {isLoading ? (
          <Skeleton className="h-64 rounded-xl" />
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
                  <TableRow className="bg-(--bg-input)/50 hover:bg-(--bg-input)/50">
                    <TableHead>ID</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead className="text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        <Coins className="h-3.5 w-3.5" />
                        Input/M
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredModels.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="max-w-45 font-mono text-[11px] text-(--text-muted)">
                        <span className="truncate block">{m.id}</span>
                      </TableCell>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      <TableCell className="text-(--text-muted)">{m.providerName}</TableCell>
                      <TableCell>
                        {m.recommendedRole ? (
                          <Badge variant="outline" className="text-[10px] font-semibold">
                            {ROLE_LABELS[m.recommendedRole] ?? m.recommendedRole}
                          </Badge>
                        ) : (
                          <span className="text-(--text-dim)">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-(--text-muted)">
                        ${m.pricing.inputPerMillion.toFixed(3)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <p className="text-[11px] leading-relaxed text-(--text-muted)">
          Para adicionar ou alterar providers e modelos, edite{' '}
          <code className="rounded bg-(--bg-input) px-1.5 py-0.5 font-mono text-[10px]">
            nanoclaw/src/llm/catalog.ts
          </code>{' '}
          e reinicie o serviço.
        </p>
      </div>
    </div>
  )
}
