import React from 'react'
import { useTranslation } from 'react-i18next'
import { Coins } from 'lucide-react'
import { ModelSelect } from '@/components/common/ModelSelect'
import { RoleInferenceFields } from '@/components/config/RoleInferenceFields'
import { configTypography as ty } from '@/components/config/config-typography'
import type { InferenceParamsForm, InferenceRole } from '@/components/config/RoleInferenceParamsForm'
import type { ModelPricing, ProviderMeta } from '@/lib/model-registry'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/templates/StatusBadge'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface GroupRoleModelCardProps {
  role: InferenceRole
  label: string
  hint: string
  accentClass: string
  value: string
  inferenceParams?: InferenceParamsForm
  pricing: ModelPricing | null
  usdToBrlRate: number
  providers: Record<string, ProviderMeta>
  disabled?: boolean
  onModelChange: (modelId: string) => void
  onInferenceChange: (params: InferenceParamsForm | undefined) => void
}

export const GroupRoleModelCard: React.FC<GroupRoleModelCardProps> = ({
  role,
  label,
  hint,
  accentClass,
  value,
  inferenceParams,
  pricing,
  usdToBrlRate,
  providers,
  disabled,
  onModelChange,
  onInferenceChange,
}) => {
  const { t } = useTranslation('config')
  const isEmpty = !value.trim()
  const hasInferenceOverrides = Boolean(inferenceParams && Object.keys(inferenceParams).length > 0)
  const hasPricing = Boolean(
    pricing && (pricing.inputPerMillion > 0 || pricing.outputPerMillion > 0),
  )

  return (
    <div
      data-role={role}
      className="flex min-w-0 flex-col gap-5 rounded-xl border border-(--border-main) bg-(--bg-card-subtle)/30 p-4 sm:p-5"
    >
      <header className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={cn(ty.cardTitle, accentClass)}>{label}</h3>
          {isEmpty ? (
            <StatusBadge variant="warning" className="font-normal">
              {t('chipRequired')}
            </StatusBadge>
          ) : hasInferenceOverrides ? (
            <Badge
              variant="outline"
              className="border-sky-500/30 bg-sky-500/10 font-normal text-sky-700 dark:text-sky-300"
            >
              {t('chipCustomParams')}
            </Badge>
          ) : null}
        </div>
        <p className={ty.cardSubtitle}>{hint}</p>
      </header>

      <section className="space-y-2">
        <Label>{t('fieldModel')}</Label>
        <ModelSelect
          providers={providers}
          className="w-full rounded-lg border border-(--border-main) bg-(--bg-input) px-3 py-2.5 font-mono text-sm text-(--text-input) focus:outline-none focus:border-sky-500"
          value={value}
          onChange={onModelChange}
          disabled={disabled}
          allowEmpty
          emptyLabel={t('modelSelectPlaceholder')}
        />
      </section>

      <section className="space-y-2 border-t border-(--border-main)/50 pt-4">
        <Label>{t('fieldInferenceParams')}</Label>
        <RoleInferenceFields value={inferenceParams} onChange={onInferenceChange} />
      </section>

      <section className="space-y-2 border-t border-(--border-main)/50 pt-4">
        <div className="flex items-center gap-2">
          <Coins className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <Label className="mb-0">{t('fieldCosts')}</Label>
        </div>
        {isEmpty ? (
          <p className={ty.meta}>{t('costSelectModelFirst')}</p>
        ) : hasPricing && pricing ? (
          <div className="space-y-1.5 rounded-lg border border-(--border-main)/60 bg-(--bg-card) px-3 py-2.5">
            <p className={ty.mono}>
              {t('costPerMillionUsd', {
                input: pricing.inputPerMillion.toFixed(3),
                output: pricing.outputPerMillion.toFixed(3),
              })}
            </p>
            <p className={ty.monoMuted}>
              {t('costPerMillionBrl', {
                input: (pricing.inputPerMillion * usdToBrlRate).toFixed(2),
                output: (pricing.outputPerMillion * usdToBrlRate).toFixed(2),
              })}
            </p>
            {pricing.contextWindow && (
              <p className={ty.meta}>{t('costContextWindow', { window: pricing.contextWindow })}</p>
            )}
          </div>
        ) : (
          <p className={ty.meta}>{t('costUnavailable')}</p>
        )}
      </section>
    </div>
  )
}
