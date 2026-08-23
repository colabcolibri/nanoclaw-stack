import React, { useState, useEffect } from 'react'
import { useDefaultGroup } from '@/contexts/AppConfigContext'
import { useTranslation } from 'react-i18next'
import {
  Sliders,
  Save,
  CheckCircle2,
  AlertCircle,
  Coins,
  Cpu,
  MapPin,
  Clock,
} from 'lucide-react'
import { ApiClient } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ModelSelect } from '@/components/common/ModelSelect'
import { TimezoneSelect } from '@/components/config/TimezoneSelect'
import { RoleInferenceParamsForm, type RoleInferenceParamsState } from '@/components/config/RoleInferenceParamsForm'
import { useLlmRegistry } from '@/hooks/useLlmRegistry'
import { findModelInProviders } from '@/lib/model-registry'

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
  const group = useDefaultGroup()
  const { t } = useTranslation('config')
  const { providers, isLoading: isLoadingModels } = useLlmRegistry()
  const [config, setConfig] = useState({
    name: '',
    model: '',
    orchestratorModel: '',
    senderModel: '',
    memoModel: '',
    roleInferenceParams: {} as RoleInferenceParamsState,
    city: '',
    country: '',
    timezone: 'Europe/Brussels',
  })
  const [usdToBrlRate, setUsdToBrlRate] = useState<number>(5.5)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [effectiveModels, setEffectiveModels] = useState<{
    model?: string
    orchestratorModel?: string
    senderModel?: string
    memoModel?: string
  }>({})
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadConfig()
    loadRate()
  }, [group])

  useEffect(() => {
    if (Object.keys(providers).length > 0) {
      loadConfig()
    }
  }, [providers, group])

  const parseLocationFromConfig = (cfg: Record<string, unknown>) => {
    let city = String(cfg.city ?? '').trim()
    let country = String(cfg.country ?? '').trim()
    const location = String(cfg.location ?? '').trim()

    if (!city && !country && location) {
      const parts = location.split(',').map((part) => part.trim()).filter(Boolean)
      if (parts.length >= 2) {
        city = parts[0]
        country = parts.slice(1).join(', ')
      } else if (parts.length === 1) {
        city = parts[0]
      }
    }

    return { city, country }
  }

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
      const data = await ApiClient.getConfig(group)
      if (data.config) {
        const { city, country } = parseLocationFromConfig(data.config)
        setConfig({
          name: data.config.assistantName || data.config.name || 'Barão',
          model: data.config.model ?? '',
          orchestratorModel: data.config.orchestratorModel ?? '',
          senderModel: data.config.senderModel ?? '',
          memoModel: data.config.memoModel ?? '',
          roleInferenceParams: (data.config.roleInferenceParams ?? {}) as RoleInferenceParamsState,
          city,
          country,
          timezone: data.config.timezone || 'Europe/Brussels',
        })
        setEffectiveModels(data.config.effectiveModels ?? {})
      }
    } catch {}
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await ApiClient.saveConfig(group, {
        name: config.name,
        assistantName: config.name,
        model: config.model,
        orchestratorModel: config.orchestratorModel,
        senderModel: config.senderModel,
        memoModel: config.memoModel,
        roleInferenceParams: config.roleInferenceParams,
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

  const roleModels = [
    { key: 'worker', label: 'Worker', modelId: config.model, effectiveId: effectiveModels.model, color: 'text-sky-500' },
    {
      key: 'orchestrator',
      label: 'Orquestrador',
      modelId: config.orchestratorModel,
      effectiveId: effectiveModels.orchestratorModel,
      color: 'text-purple-500',
    },
    {
      key: 'sender',
      label: 'Sender',
      modelId: config.senderModel,
      effectiveId: effectiveModels.senderModel,
      color: 'text-emerald-500',
    },
    {
      key: 'memo',
      label: 'Memo',
      modelId: config.memoModel,
      effectiveId: effectiveModels.memoModel,
      color: 'text-amber-500',
    },
  ] as const

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

      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Card className="border-(--border-main) bg-(--bg-card) shadow-xs overflow-hidden">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-(--text-main) mb-1.5">{t('assistantName')}</label>
              <Input
                type="text"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                placeholder="Barão"
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-(--text-main) mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>{t('city')}</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3.5 py-2.5 bg-(--bg-input) border border-(--border-main) rounded-lg text-xs text-(--text-input) focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  value={config.city}
                  onChange={(e) => setConfig({ ...config, city: e.target.value })}
                  placeholder={t('cityPlaceholder')}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-(--text-main) mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t('country')}</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3.5 py-2.5 bg-(--bg-input) border border-(--border-main) rounded-lg text-xs text-(--text-input) focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  value={config.country}
                  onChange={(e) => setConfig({ ...config, country: e.target.value })}
                  placeholder={t('countryPlaceholder')}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-(--text-main) mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{t('timezone')}</span>
                </label>
                <TimezoneSelect
                  value={config.timezone}
                  onChange={(timezone) => setConfig({ ...config, timezone })}
                />
              </div>
            </div>

            {/* Roteamento por papel — cada modelo é independente */}
            <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 space-y-4">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-sky-500" />
                <span className="text-xs font-bold text-(--text-main)">
                  Roteamento de modelos por papel
                </span>
              </div>
              <p className="text-[10px] text-(--text-dim) -mt-2">
                Deixe em &quot;Padrão&quot; para usar o modelo recomendado do provider do grupo. Override só quando quiser outro modelo.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-(--text-main) mb-1">
                    Worker (execução & tools)
                  </label>
                  <ModelSelect
                    providers={providers}
                    className="w-full px-3 py-2 bg-(--bg-input) border border-(--border-main) rounded-lg text-xs text-(--text-input) focus:outline-none focus:border-sky-500 font-mono"
                    value={config.model}
                    onChange={(model) => setConfig({ ...config, model })}
                    disabled={isLoadingModels}
                    allowDefault
                    defaultLabel="Padrão (worker — catálogo)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-(--text-main) mb-1">
                    Orquestrador (triagem)
                  </label>
                  <ModelSelect
                    providers={providers}
                    className="w-full px-3 py-2 bg-(--bg-input) border border-(--border-main) rounded-lg text-xs text-(--text-input) focus:outline-none focus:border-sky-500 font-mono"
                    value={config.orchestratorModel}
                    onChange={(orchestratorModel) => setConfig({ ...config, orchestratorModel })}
                    disabled={isLoadingModels}
                    allowDefault
                    defaultLabel="Padrão (orquestrador)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-(--text-main) mb-1">
                    Sender (persona & resposta)
                  </label>
                  <ModelSelect
                    providers={providers}
                    className="w-full px-3 py-2 bg-(--bg-input) border border-(--border-main) rounded-lg text-xs text-(--text-input) focus:outline-none focus:border-sky-500 font-mono"
                    value={config.senderModel}
                    onChange={(senderModel) => setConfig({ ...config, senderModel })}
                    disabled={isLoadingModels}
                    allowDefault
                    defaultLabel="Padrão (sender)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-(--text-main) mb-1">
                    Memo (resumo semântico)
                  </label>
                  <ModelSelect
                    providers={providers}
                    className="w-full px-3 py-2 bg-(--bg-input) border border-(--border-main) rounded-lg text-xs text-(--text-input) focus:outline-none focus:border-sky-500 font-mono"
                    value={config.memoModel}
                    onChange={(memoModel) => setConfig({ ...config, memoModel })}
                    disabled={isLoadingModels}
                    allowDefault
                    defaultLabel="Padrão (memo — catálogo)"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 space-y-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-bold text-(--text-main)">Parâmetros de inferência por papel</span>
              </div>
              <RoleInferenceParamsForm
                value={config.roleInferenceParams}
                onChange={(roleInferenceParams) => setConfig({ ...config, roleInferenceParams })}
              />
            </div>

            {/* Custos por papel */}
            <div className="p-4 rounded-xl border border-(--border-main) bg-(--bg-card-subtle) space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-(--text-main)">Custos por papel (referência)</span>
                </div>
                <span className="text-[10px] font-mono text-(--text-dim)">
                  1 USD = R$ {usdToBrlRate.toFixed(2)}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {roleModels.map((role) => {
                  const displayId = role.modelId || role.effectiveId || ''
                  const modelObj = findModelInProviders(providers, displayId)
                  const pricing = modelObj?.pricing || DEFAULT_PRICING
                  return (
                    <div
                      key={role.key}
                      className="p-3 bg-(--bg-card) border border-(--border-main) rounded-xl space-y-1"
                    >
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${role.color}`}>{role.label}</div>
                      <div className="text-[10px] font-mono text-(--text-dim) truncate">
                        {role.modelId ? role.modelId : `Padrão → ${role.effectiveId || '…'}`}
                      </div>
                      <div className="text-xs font-mono text-(--text-main)">
                        in ${pricing.inputPerMillion.toFixed(3)} · out ${pricing.outputPerMillion.toFixed(3)}
                      </div>
                      <div className="text-[10px] text-(--text-dim) font-mono">
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
