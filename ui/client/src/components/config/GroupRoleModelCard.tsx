import React from 'react'
import { ModelSelect } from '@/components/common/ModelSelect'
import type { ProviderMeta } from '@/lib/model-registry'
import { cn } from '@/lib/utils'

interface GroupRoleModelCardProps {
  label: string
  hint: string
  accentClass: string
  value: string
  effectiveId?: string
  providers: Record<string, ProviderMeta>
  disabled?: boolean
  defaultLabel: string
  onChange: (modelId: string) => void
}

export const GroupRoleModelCard: React.FC<GroupRoleModelCardProps> = ({
  label,
  hint,
  accentClass,
  value,
  effectiveId,
  providers,
  disabled,
  defaultLabel,
  onChange,
}) => {
  const resolved = value.trim() || effectiveId || '—'
  const isDefault = !value.trim()

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-(--border-main) bg-(--bg-card-subtle)/30 p-4">
      <div className="min-w-0 space-y-1">
        <div className={cn('text-[10px] font-bold uppercase tracking-wider', accentClass)}>{label}</div>
        <p className="text-[11px] leading-relaxed text-(--text-dim)">{hint}</p>
      </div>
      <ModelSelect
        providers={providers}
        className="w-full rounded-lg border border-(--border-main) bg-(--bg-input) px-3 py-2 font-mono text-xs text-(--text-input) focus:outline-none focus:border-sky-500"
        value={value}
        onChange={onChange}
        disabled={disabled}
        allowDefault
        defaultLabel={defaultLabel}
      />
      <div className="rounded-lg border border-(--border-main)/60 bg-(--bg-card) px-3 py-2">
        <p className="text-[10px] font-medium text-(--text-dim)">Efetivo agora</p>
        <p className="mt-0.5 truncate font-mono text-xs text-(--text-main)">
          {isDefault ? `Padrão → ${resolved}` : resolved}
        </p>
      </div>
    </div>
  )
}
