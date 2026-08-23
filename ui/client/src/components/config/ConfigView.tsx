import React, { useState, useEffect, useMemo } from 'react'
import { useDefaultGroup } from '@/contexts/AppConfigContext'
import { useTranslation } from 'react-i18next'
import {
  Save,
  CheckCircle2,
  AlertCircle,
  Cpu,
  MapPin,
  Clock,
  UserRound,
} from 'lucide-react'
import { ApiClient } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TimezoneSelect } from '@/components/config/TimezoneSelect'
import { ConfigSectionCard } from '@/components/config/ConfigSectionCard'
import { configTypography as ty } from '@/components/config/config-typography'
import { GroupRoleModelCard } from '@/components/config/GroupRoleModelCard'
import type { InferenceParamsForm, InferenceRole, RoleInferenceParamsState } from '@/components/config/RoleInferenceParamsForm'
import { useLlmRegistry } from '@/hooks/useLlmRegistry'
import { findModelInProviders } from '@/lib/model-registry'
import { cn } from '@/lib/utils'

export type { ModelItem, ModelPricing, ProviderMeta } from '@/lib/model-registry'

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
    const missing = [
      !config.model.trim() && 'Worker',
      !config.orchestratorModel.trim() && t('roleOrchestrator'),
      !config.senderModel.trim() && 'Sender',
      !config.memoModel.trim() && 'Memo',
    ].filter(Boolean) as string[]

    if (missing.length > 0) {
      setToast({ text: t('modelRequired'), type: 'error' })
      setTimeout(() => setToast(null), 4000)
      return
    }

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

  const setRoleInference = (role: InferenceRole, params: InferenceParamsForm | undefined) => {
    setConfig((c) => {
      const next = { ...c.roleInferenceParams }
      if (!params || Object.keys(params).length === 0) {
        delete next[role]
      } else {
        next[role] = params
      }
      return { ...c, roleInferenceParams: next }
    })
  }

  const roleModels = useMemo(
    () =>
      [
        {
          key: 'worker' as const,
          label: 'Worker',
          hint: t('roleWorkerHint'),
          modelId: config.model,
          accentClass: 'text-sky-500',
          onModelChange: (model: string) => setConfig((c) => ({ ...c, model })),
        },
        {
          key: 'orchestrator' as const,
          label: t('roleOrchestrator'),
          hint: t('roleOrchestratorHint'),
          modelId: config.orchestratorModel,
          accentClass: 'text-purple-500',
          onModelChange: (orchestratorModel: string) => setConfig((c) => ({ ...c, orchestratorModel })),
        },
        {
          key: 'sender' as const,
          label: 'Sender',
          hint: t('roleSenderHint'),
          modelId: config.senderModel,
          accentClass: 'text-emerald-500',
          onModelChange: (senderModel: string) => setConfig((c) => ({ ...c, senderModel })),
        },
        {
          key: 'memo' as const,
          label: 'Memo',
          hint: t('roleMemoHint'),
          modelId: config.memoModel,
          accentClass: 'text-amber-500',
          onModelChange: (memoModel: string) => setConfig((c) => ({ ...c, memoModel })),
        },
      ] satisfies Array<{
        key: InferenceRole
        label: string
        hint: string
        modelId: string
        accentClass: string
        onModelChange: (id: string) => void
      }>,
    [config, t],
  )

  const inputClass =
    'w-full rounded-lg border border-(--border-main) bg-(--bg-input) px-3.5 py-2.5 text-sm text-(--text-input) focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500'

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
          {roleModels.map((role) => (
            <Badge
              key={role.key}
              variant={role.modelId.trim() ? 'outline' : 'warning'}
              className="max-w-full truncate font-mono font-normal"
            >
              <span className={cn('mr-1.5 font-semibold', role.accentClass)}>{role.label}</span>
              {role.modelId.trim() || t('chipRequired')}
            </Badge>
          ))}
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
              <TabsTrigger value="general" className="text-sm">
                {t('tabGeneral')}
              </TabsTrigger>
              <TabsTrigger value="models" className="text-sm">
                {t('tabModels')}
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
                <div className="space-y-2">
                <Label>{t('assistantName')}</Label>
                <Input
                  type="text"
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  placeholder="Barão"
                  className="text-sm"
                />
                </div>
              </ConfigSectionCard>

              <ConfigSectionCard
                title={t('sectionLocale')}
                description={t('sectionLocaleDesc')}
                icon={MapPin}
                iconClassName="text-rose-500"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-rose-500" />
                      {t('city')}
                    </Label>
                    <input
                      type="text"
                      className={inputClass}
                      value={config.city}
                      onChange={(e) => setConfig({ ...config, city: e.target.value })}
                      placeholder={t('cityPlaceholder')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-amber-500" />
                      {t('country')}
                    </Label>
                    <input
                      type="text"
                      className={inputClass}
                      value={config.country}
                      onChange={(e) => setConfig({ ...config, country: e.target.value })}
                      placeholder={t('countryPlaceholder')}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-indigo-500" />
                      {t('timezone')}
                    </Label>
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {roleModels.map((role) => {
                  const modelObj = role.modelId.trim()
                    ? findModelInProviders(providers, role.modelId.trim())
                    : undefined
                  return (
                    <GroupRoleModelCard
                      key={role.key}
                      role={role.key}
                      label={role.label}
                      hint={role.hint}
                      accentClass={role.accentClass}
                      value={role.modelId}
                      inferenceParams={config.roleInferenceParams[role.key]}
                      pricing={modelObj?.pricing ?? null}
                      usdToBrlRate={usdToBrlRate}
                      providers={providers}
                      disabled={isLoadingModels}
                      onModelChange={role.onModelChange}
                      onInferenceChange={(params) => setRoleInference(role.key, params)}
                    />
                  )
                })}
              </div>
              <footer className="mt-5 space-y-1 border-t border-(--border-main)/50 pt-4">
                <p className={ty.footnote}>{t('inferenceInlineHint')}</p>
                <p className={ty.footnote}>
                  {t('costsFootnote', { rate: usdToBrlRate.toFixed(2) })}
                </p>
              </footer>
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
