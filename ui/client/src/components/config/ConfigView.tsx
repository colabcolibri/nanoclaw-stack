import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Sliders,
  Save,
  CheckCircle2,
  AlertCircle,
  Check,
  Zap,
  ArrowDownToLine,
  ArrowUpFromLine,
  Layers,
  Database,
  Target,
  Coins,
  Cpu,
  MapPin,
  Clock,
  KeyRound,
  ExternalLink,
} from 'lucide-react'
import { ApiClient } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ModelSelect } from '@/components/common/ModelSelect'
import { useLlmRegistry } from '@/hooks/useLlmRegistry'
import { findModelInProviders, providersForModels } from '@/lib/model-registry'

export type { ModelItem, ModelPricing, ProviderMeta } from '@/lib/model-registry'

const DEFAULT_PRICING = {
  inputPerMillion: 0,
  outputPerMillion: 0,
  cacheWritePerMillion: 0,
  cacheHitPerMillion: 0,
  contextWindow: '128k',
  savingsPct: 0,
}

export const ConfigView: React.FC = () => {
  const { t } = useTranslation('config')
  const { providers, isLoading: isLoadingModels } = useLlmRegistry()
  const [config, setConfig] = useState({
    name: '',
    model: '',
    orchestratorModel: '',
    senderModel: '',
    city: '',
    country: '',
    timezone: 'Europe/Brussels',
  })
  const [keysStatus, setKeysStatus] = useState<Record<string, { hasKey: boolean; masked: string }>>({})
  const [usdToBrlRate, setUsdToBrlRate] = useState<number>(5.5)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadConfig()
    loadRate()
  }, [])

  useEffect(() => {
    if (Object.keys(providers).length > 0) {
      loadConfig()
    }
  }, [providers])

  const loadRate = async () => {
    try {
      const stats = await ApiClient.getStats()
      if (stats.usdToBrlRate && stats.usdToBrlRate > 0) {
        setUsdToBrlRate(stats.usdToBrlRate)
      }
    } catch {}
  }

  const loadConfig = async () => {
    try {
      const data = await ApiClient.getConfig('barao')
      if (data.config) {
        setConfig({
          name: data.config.assistantName || data.config.name || 'Barão',
          model: data.config.model ?? '',
          orchestratorModel: data.config.orchestratorModel ?? '',
          senderModel: data.config.senderModel ?? '',
          city: data.config.city ?? '',
          country: data.config.country || data.config.location || '',
          timezone: data.config.timezone || 'Europe/Brussels',
        })
        if (data.config.keysStatus) {
          setKeysStatus(data.config.keysStatus)
        }
      }
    } catch {}
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!config.model || !config.orchestratorModel || !config.senderModel) {
      setToast({ text: t('modelRequired') || 'Selecione os três modelos (worker, orchestrator, sender).', type: 'error' })
      setTimeout(() => setToast(null), 3000)
      return
    }
    setIsSaving(true)
    try {
      await ApiClient.saveConfig('barao', {
        name: config.name,
        assistantName: config.name,
        model: config.model,
        orchestratorModel: config.orchestratorModel,
        senderModel: config.senderModel,
        city: config.city,
        country: config.country,
        timezone: config.timezone,
      })
      setToast({ text: t('savedSuccess'), type: 'success' })
      await loadConfig()
      setTimeout(() => setToast(null), 3000)
    } catch {
      setToast({ text: t('saveError'), type: 'error' })
      setTimeout(() => setToast(null), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const usedProviderIds = useMemo(
    () => providersForModels(providers, [config.model, config.orchestratorModel, config.senderModel]),
    [providers, config.model, config.orchestratorModel, config.senderModel]
  )

  const roleModels = [
    { key: 'worker', label: 'Worker', modelId: config.model, color: 'text-sky-500' },
    { key: 'orchestrator', label: 'Orquestrador', modelId: config.orchestratorModel, color: 'text-purple-500' },
    { key: 'sender', label: 'Sender', modelId: config.senderModel, color: 'text-emerald-500' },
  ] as const

  const missingKeys = usedProviderIds.filter((pid) => !keysStatus[pid]?.hasKey)

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 animate-in fade-in ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{toast.text}</span>
        </div>
      )}

      <PageHeader icon={<Sliders className="w-5 h-5" />} title={t('title')} subtitle={t('subtitle')} />

      <Card className="border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs overflow-hidden">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5">{t('assistantName')}</label>
              <input
                type="text"
                className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                placeholder="Barão"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>{t('city')}</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  value={config.city}
                  onChange={(e) => setConfig({ ...config, city: e.target.value })}
                  placeholder={t('cityPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t('country')}</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  value={config.country}
                  onChange={(e) => setConfig({ ...config, country: e.target.value })}
                  placeholder={t('countryPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{t('timezone')}</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  value={config.timezone}
                  onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
                  placeholder="Europe/Brussels"
                />
              </div>
            </div>

            {/* Roteamento por papel — cada modelo é independente */}
            <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 space-y-4">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-sky-500" />
                <span className="text-xs font-bold text-[var(--text-main)]">
                  Roteamento de modelos por papel
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-dim)] -mt-2">
                Cada papel pode usar um modelo (e provider) diferente. O catálogo vem de Modelos LLM.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                    Worker (execução & tools)
                  </label>
                  <ModelSelect
                    providers={providers}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] focus:outline-none focus:border-sky-500 font-mono"
                    value={config.model}
                    onChange={(model) => setConfig({ ...config, model })}
                    disabled={isLoadingModels}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                    Orquestrador (triagem)
                  </label>
                  <ModelSelect
                    providers={providers}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] focus:outline-none focus:border-sky-500 font-mono"
                    value={config.orchestratorModel}
                    onChange={(orchestratorModel) => setConfig({ ...config, orchestratorModel })}
                    disabled={isLoadingModels}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                    Sender (persona & resposta)
                  </label>
                  <ModelSelect
                    providers={providers}
                    className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] focus:outline-none focus:border-sky-500 font-mono"
                    value={config.senderModel}
                    onChange={(senderModel) => setConfig({ ...config, senderModel })}
                    disabled={isLoadingModels}
                  />
                </div>
              </div>
            </div>

            {/* Status de credenciais (somente leitura) */}
            <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card-subtle)] space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-[var(--text-main)]">{t('credentialsTitle')}</span>
                </div>
                <a
                  href="#models"
                  className="text-[10px] font-bold text-sky-500 hover:text-sky-400 flex items-center gap-1"
                >
                  {t('manageKeys')}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-[10px] text-[var(--text-dim)]">{t('credentialsHint')}</p>
              <div className="flex flex-wrap gap-2">
                {usedProviderIds.map((pid) => {
                  const meta = providers[pid]
                  const keyInfo = keysStatus[pid] || { hasKey: false, masked: '' }
                  return (
                    <div
                      key={pid}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-main)] bg-[var(--bg-card)]"
                    >
                      <span className="text-xs font-medium text-[var(--text-main)]">{meta?.name || pid}</span>
                      {keyInfo.hasKey ? (
                        <Badge variant="success" className="text-[9px]">
                          <Check className="w-2.5 h-2.5" />
                          {t('keyOk')}
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="text-[9px] bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300">
                          <AlertCircle className="w-2.5 h-2.5" />
                          {t('keyMissing')}
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
              {missingKeys.length > 0 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  Providers sem chave: {missingKeys.map((id) => providers[id]?.name || id).join(', ')}. Configure em
                  Modelos LLM antes de usar esses modelos.
                </p>
              )}
            </div>

            {/* Custos por papel */}
            <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card-subtle)] space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-[var(--text-main)]">Custos por papel (referência)</span>
                </div>
                <span className="text-[10px] font-mono text-[var(--text-dim)]">
                  1 USD = R$ {usdToBrlRate.toFixed(2)}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {roleModels.map((role) => {
                  const modelObj = findModelInProviders(providers, role.modelId)
                  const pricing = modelObj?.pricing || DEFAULT_PRICING
                  return (
                    <div
                      key={role.key}
                      className="p-3 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl space-y-1"
                    >
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${role.color}`}>{role.label}</div>
                      <div className="text-[10px] font-mono text-[var(--text-dim)] truncate">{role.modelId}</div>
                      <div className="text-xs font-mono text-[var(--text-main)]">
                        in ${pricing.inputPerMillion.toFixed(3)} · out ${pricing.outputPerMillion.toFixed(3)}
                      </div>
                      <div className="text-[10px] text-[var(--text-dim)] font-mono">
                        ~R$ {(pricing.inputPerMillion * usdToBrlRate).toFixed(2)} / R${' '}
                        {(pricing.outputPerMillion * usdToBrlRate).toFixed(2)} por 1M
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <Button type="submit" disabled={isSaving} className="mt-2 gap-2 h-10 px-6 font-bold shadow-xs cursor-pointer">
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Salvando...' : t('save')}</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
