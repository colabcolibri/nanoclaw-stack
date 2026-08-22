import React from 'react'
import type { ProviderMeta } from '@/lib/model-registry'

interface ModelSelectProps {
  value: string
  onChange: (modelId: string) => void
  providers: Record<string, ProviderMeta>
  className?: string
  id?: string
  disabled?: boolean
}

/** Select de modelos alimentado pelo registry do banco (via API). */
export const ModelSelect: React.FC<ModelSelectProps> = ({
  value,
  onChange,
  providers,
  className,
  id,
  disabled,
}) => {
  const entries = Object.entries(providers)

  if (entries.length === 0) {
    return (
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={className} disabled>
        <option value={value}>{value || 'Carregando modelos...'}</option>
      </select>
    )
  }

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      disabled={disabled}
    >
      {entries.map(([pKey, pMeta]) => (
        <optgroup key={pKey} label={pMeta.name}>
          {pMeta.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
