import React, { useState, useEffect, useMemo } from 'react'
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
  UserRound,
  Sparkles,
} from 'lucide-react'
import { ApiClient } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TimezoneSelect } from '@/components/config/TimezoneSelect'
import { ConfigSectionCard } from '@/components/config/ConfigSectionCard'
import { GroupRoleModelCard } from '@/components/config/GroupRoleModelCard'
import { RoleInferenceParamsForm, type RoleInferenceParamsState } from '@/components/config/RoleInferenceParamsForm'
import { useLlmRegistry } from '@/hooks/useLlmRegistry'
import { findModelInProviders } from '@/lib/model-registry'
import { cn } from '@/lib/utils'

export type { ModelItem, ModelPricing, ProviderMeta } from '@/lib/model-registry'

const DEFAULT_PRICING = {
  inputPerMillion: 0,
  outputPerMillion: 0,
  cacheWritePerMillion: 0,
  cacheHitPerMillion: 0,
  contextWindow: '128k',
  savingsPct: 0,
}

interface GroupConfigState {
  name: string
  model: string
  orchestratorModel: string
  senderModel: string
  memoModel: string
  roleInferenceParams: RoleInferenceParamsState
  city: string
  country: string
  timezone: string
}

function parseLocationFromConfig(cfg: Record<string, unknown>) {
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

export const ConfigView: React.FC = () => {
  const group = useDefaultGroup()
  const { t } = useTranslation('config')
  const { providers, isLoading: isLoadingModels } = useLlmRegistry()
  const [config, setConfig] = useState<GroupConfigState>({
    name: '',
    model: '',
    orchestratorModel: '',
    senderModel: '',
    memoModel: '',
    roleInferenceParams: {},
    city: '',
    country: '',
    timezone: 'Europe/Brussels',
  })
  const [usdToBrlRate, setUsdToBrlRate] = useState(5.5)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [effectiveModels, setEffectiveModels] = useState<{
    model?: string
    orchestratorModel?: string
    senderModel?: string
    memoModel?: string
  }>({})
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const loadConfig = async () => {
    setIsLoading(true)
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
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false)
    }
  }

  const loadRate = async () => {
    try {
      const stats = await ApiClient.getStats()
      if (stats.usdToBrlRate && stats.usdToBrlRate > 0) {
        setUsdToBrlRate(stats.usdToBrlRate)
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadConfig()
    loadRate()
  }, [group])

  useEffect(() => {
    if (Object.keys(providers).length > 0) {
      loadConfig()
    }
  }, [providers, group])

  const handleSave = async () => {
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

  const roleModels = useMemo(
    () => [
      {
        key: 'worker',
        label: 'Worker',
        hint: t('roleWorkerHint'),
        modelId: config.model,
        effectiveId: effectiveModels.model,
        accentClass: 'text-sky-500',
        defaultLabel: effectiveModels.model
          ? `${t('defaultCatalog')} → ${effectiveModels.model}`
          : t('defaultWorker'),
        onChange: (model: string) => setConfig((c) => ({ ...c, model })),
      },
      {
        key: 'orchestrator',
        label: t('roleOrchestrator'),
        hint: t('roleOrchestratorHint'),
        modelId: config.orchestratorModel,
        effectiveId: effectiveModels.orchestratorModel,
        accentClass: 'text-purple-500',
        defaultLabel: t('defaultOrchestrator'),
        onChange: (orchestratorModel: string) => setConfig((c) => ({ ...c, orchestratorModel })),
      },
      {
        key: 'sender',
        label: 'Sender',
        hint: t('roleSenderHint'),
        modelId: config.senderModel,
        effectiveId: effectiveModels.senderModel,
        accentClass: 'text-emerald-500',
        defaultLabel: t('defaultSender'),
        onChange: (senderModel: string) => setConfig((c) => ({ ...c, senderModel })),
      },
      {
        key: 'memo',
        label: 'Memo',
        hint: t('roleMemoHint'),
        modelId: config.memoModel,
        effectiveId: effectiveModels.memoModel,
        accentClass: 'text-amber-500',
        defaultLabel: t('defaultMemo'),
        onChange: (memoModel: string) => setConfig((c) => ({ ...c, memoModel })),
      },
    ],
    [config, effectiveModels, t],
  )

  const inputClass =
    'w-full rounded-lg border border-(--border-main) bg-(--bg-input) px-3.5 py-2.5 text-xs text-(--text-input) focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500'

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-5">
      {toast && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold animate-in fade-in',
            toast.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-900 dark:text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/15 text-rose-900 dark:text-rose-300',
          )}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      <PageHeader
        view="config"
        subtitle={t('subtitle')}
        actions={
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <Save className={cn('h-3.5 w-3.5', isSaving && 'animate-pulse')} />
            {isSaving ? t('saving') : t('save')}
          </Button>
        }
      />

      {!isLoading && (
        <div className="flex flex-wrap gap-2">
          {roleModels.map((role) => {
            const id = role.modelId || role.effectiveId || '…'
            return (
              <Badge
                key={role.key}
                variant="outline"
                className="max-w-full truncate font-mono text-[10px] font-normal"
              >
                <span className={cn('mr-1.5 font-semibold', role.accentClass)}>{role.label}</span>
                {role.modelId ? id : `padrão → ${id}`}
              </Badge>
            )
          })}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="col-span-full h-64 rounded-xl" />
        </div>
      ) : (
        <Tabs defaultValue="general" className="w-full min-w-0">
          <div className="overflow-x-auto overflow-y-hidden pb-1">
            <TabsList className="inline-flex h-auto w-max min-w-full justify-start gap-1 rounded-lg p-1 sm:min-w-0">
              <TabsTrigger value="general" className="text-xs">
                {t('tabGeneral')}
              </TabsTrigger>
              <TabsTrigger value="models" className="text-xs">
                {t('tabModels')}
              </TabsTrigger>
              <TabsTrigger value="inference" className="text-xs">
                {t('tabInference')}
              </TabsTrigger>
              <TabsTrigger value="costs" className="text-xs">
                {t('tabCosts')}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="general" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <ConfigSectionCard
                title={t('sectionIdentity')}
                description={t('sectionIdentityDesc')}
                icon={UserRound}
                iconClassName="text-sky-500"
              >
                <label className="mb-1.5 block text-xs font-semibold text-(--text-main)">
                  {t('assistantName')}
                </label>
                <Input
                  type="text"
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  placeholder="Barão"
                  className="text-xs"
                />
              </ConfigSectionCard>

              <ConfigSectionCard
                title={t('sectionLocale')}
                description={t('sectionLocaleDesc')}
                icon={MapPin}
                iconClassName="text-rose-500"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-(--text-main)">
                      <MapPin className="h-3.5 w-3.5 text-rose-500" />
                      {t('city')}
                    </label>
                    <input
                      type="text"
                      className={inputClass}
                      value={config.city}
                      onChange={(e) => setConfig({ ...config, city: e.target.value })}
                      placeholder={t('cityPlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-(--text-main)">
                      <MapPin className="h-3.5 w-3.5 text-amber-500" />
                      {t('country')}
                    </label>
                    <input
                      type="text"
                      className={inputClass}
                      value={config.country}
                      onChange={(e) => setConfig({ ...config, country: e.target.value })}
                      placeholder={t('countryPlaceholder')}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-(--text-main)">
                      <Clock className="h-3.5 w-3.5 text-indigo-500" />
                      {t('timezone')}
                    </label>
                    <TimezoneSelect
                      value={config.timezone}
                      onChange={(timezone) => setConfig({ ...config, timezone })}
                    />
                  </div>
                </div>
              </ConfigSectionCard>
            </div>
          </TabsContent>

          <TabsContent value="models" className="mt-4 space-y-4">
            <ConfigSectionCard
              title={t('sectionModels')}
              description={t('sectionModelsDesc')}
              icon={Cpu}
              iconClassName="text-sky-500"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {roleModels.map((role) => (
                  <GroupRoleModelCard
                    key={role.key}
                    label={role.label}
                    hint={role.hint}
                    accentClass={role.accentClass}
                    value={role.modelId}
                    effectiveId={role.effectiveId}
                    providers={providers}
                    disabled={isLoadingModels}
                    defaultLabel={role.defaultLabel}
                    onChange={role.onChange}
                  />
                ))}
              </div>
            </ConfigSectionCard>
          </TabsContent>

          <TabsContent value="inference" className="mt-4 space-y-4">
            <ConfigSectionCard
              title={t('sectionInference')}
              description={t('sectionInferenceDesc')}
              icon={Sliders}
              iconClassName="text-indigo-500"
            >
              <RoleInferenceParamsForm
                value={config.roleInferenceParams}
                onChange={(roleInferenceParams) => setConfig({ ...config, roleInferenceParams })}
              />
            </ConfigSectionCard>
          </TabsContent>

          <TabsContent value="costs" className="mt-4 space-y-4">
            <ConfigSectionCard
              title={t('sectionCosts')}
              description={t('sectionCostsDesc')}
              icon={Coins}
              iconClassName="text-amber-500"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-(--text-muted)">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  {t('costsReference')}
                </div>
                <span className="font-mono text-[10px] text-(--text-dim)">
                  1 USD = R$ {usdToBrlRate.toFixed(2)}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {roleModels.map((role) => {
                  const displayId = role.modelId || role.effectiveId || ''
                  const modelObj = findModelInProviders(providers, displayId)
                  const pricing = modelObj?.pricing || DEFAULT_PRICING
                  return (
                    <div
                      key={role.key}
                      className="rounded-xl border border-(--border-main) bg-(--bg-card-subtle)/40 p-4"
                    >
                      <div className={cn('text-[10px] font-bold uppercase tracking-wider', role.accentClass)}>
                        {role.label}
                      </div>
                      <p className="mt-1 truncate font-mono text-[10px] text-(--text-dim)">
                        {role.modelId ? role.modelId : `padrão → ${role.effectiveId || '…'}`}
                      </p>
                      <p className="mt-3 font-mono text-xs text-(--text-main)">
                        in ${pricing.inputPerMillion.toFixed(3)} · out ${pricing.outputPerMillion.toFixed(3)}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-(--text-dim)">
                        ~R$ {(pricing.inputPerMillion * usdToBrlRate).toFixed(2)} / R${' '}
                        {(pricing.outputPerMillion * usdToBrlRate).toFixed(2)} / 1M
                      </p>
                    </div>
                  )
                })}
              </div>
            </ConfigSectionCard>
          </TabsContent>
        </Tabs>
      )}

      <div className="sticky bottom-0 z-10 -mx-1 border-t border-(--border-main)/60 bg-(--bg-main)/90 px-1 py-3 backdrop-blur-md sm:hidden">
        <Button
          type="button"
          className="h-10 w-full gap-2 font-semibold"
          onClick={handleSave}
          disabled={isSaving || isLoading}
        >
          <Save className="h-4 w-4" />
          {isSaving ? t('saving') : t('save')}
        </Button>
      </div>
    </div>
  )
}
