import React, { useState, useEffect } from 'react'
import {
  Database,
  RefreshCw,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Server,
  Coins,
} from 'lucide-react'
import { ApiClient } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useLlmRegistry, invalidateLlmRegistryCache } from '@/hooks/useLlmRegistry'

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
    } catch {}
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

  const allModels = providerEntries.flatMap(([pid, meta]) =>
    meta.models.map((m) => ({ ...m, providerId: pid, providerName: meta.name }))
  )

  const filteredModels = allModels.filter((m) => {
    const matchProvider = selectedProvider === 'all' || m.providerId === selectedProvider
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      m.id.toLowerCase().includes(q) ||
      m.label.toLowerCase().includes(q) ||
      m.providerName.toLowerCase().includes(q)
    return matchProvider && matchSearch
  })

  const inputClass =
    'w-full px-3 py-2 bg-(--bg-input) border border-(--border-main) rounded-lg text-xs text-(--text-input) focus:outline-none focus:border-sky-500 font-mono'

  return (
    <div className="flex flex-col gap-5 w-full flex-1 min-w-0">
      <PageHeader
        view="models"
        subtitle="Catálogo versionado no código (nanoclaw/src/llm/catalog.ts). Aqui você só gerencia credenciais."
        actions={
          <Button variant="outline" size="sm" onClick={refreshRegistry} disabled={isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        }
      />

      {toast && (
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.text}
        </div>
      )}

      <Card>
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-(--text-secondary)">
            <KeyRound className="w-4 h-4" />
            Credenciais por provider
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {providerEntries.map(([id, meta]) => {
              const status = keysStatus[id]
              return (
                <div
                  key={id}
                  className="flex flex-col gap-2 p-3 rounded-lg border border-(--border-main) bg-(--bg-card) min-w-0"
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{meta.name}</p>
                      <p className="text-[10px] text-(--text-muted) font-mono truncate">{meta.keyEnvName ?? id}</p>
                    </div>
                    <Badge variant={status?.hasKey ? 'default' : 'outline'} className="shrink-0 text-[10px]">
                      {status?.hasKey ? 'OK' : 'Ausente'}
                    </Badge>
                  </div>
                  {status?.hasKey && status.masked && (
                    <p className="text-[10px] text-(--text-muted) font-mono truncate">{status.masked}</p>
                  )}
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Nova API key"
                      value={newApiKeys[id] ?? ''}
                      onChange={(e) => setNewApiKeys((prev) => ({ ...prev, [id]: e.target.value }))}
                      className="font-mono text-xs"
                    />
                    <Button
                      size="sm"
                      disabled={!newApiKeys[id]?.trim() || savingKeyFor === id}
                      onClick={() => handleSaveProviderKey(id)}
                      className="shrink-0"
                    >
                      {savingKeyFor === id ? '...' : 'Salvar'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-(--text-secondary)">
              <Server className="w-4 h-4" />
              Modelos disponíveis ({filteredModels.length})
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className={`${inputClass} sm:w-48`}
              >
                <option value="all">Todos os providers</option>
                {providerEntries.map(([id, meta]) => (
                  <option key={id} value={id}>
                    {meta.name}
                  </option>
                ))}
              </select>
              <input
                type="search"
                placeholder="Buscar modelo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputClass} sm:w-56`}
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-(--border-main)">
            <table className="w-full text-xs min-w-160">
              <thead className="bg-(--bg-input) text-(--text-muted)">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">ID</th>
                  <th className="text-left px-3 py-2 font-medium">Nome</th>
                  <th className="text-left px-3 py-2 font-medium">Provider</th>
                  <th className="text-left px-3 py-2 font-medium">Papel</th>
                  <th className="text-right px-3 py-2 font-medium">
                    <Coins className="w-3.5 h-3.5 inline" /> Input/M
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-(--text-muted)">
                      Carregando catálogo...
                    </td>
                  </tr>
                ) : filteredModels.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-(--text-muted)">
                      Nenhum modelo encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredModels.map((m) => (
                    <tr key={m.id} className="border-t border-(--border-main) hover:bg-(--bg-input)/50">
                      <td className="px-3 py-2 font-mono text-[10px] max-w-45 truncate">{m.id}</td>
                      <td className="px-3 py-2">{m.label}</td>
                      <td className="px-3 py-2 text-(--text-muted)">{m.providerName}</td>
                      <td className="px-3 py-2">
                        {m.recommendedRole ? (
                          <Badge variant="outline" className="text-[10px]">
                            {m.recommendedRole}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">${m.pricing.inputPerMillion.toFixed(3)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-(--text-muted)">
            Para adicionar ou alterar providers e modelos, edite{' '}
            <code className="font-mono">nanoclaw/src/llm/catalog.ts</code> e reinicie o serviço.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
