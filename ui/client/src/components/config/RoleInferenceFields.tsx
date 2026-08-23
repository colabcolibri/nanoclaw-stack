import React from 'react'
import { useTranslation } from 'react-i18next'
import type { InferenceParamsForm } from '@/components/config/RoleInferenceParamsForm'
import { Label } from '@/components/ui/label'

const PARAM_FIELDS: Array<{
  key: keyof InferenceParamsForm
  labelKey: string
  step?: string
  min?: string
  max?: string
}> = [
  { key: 'temperature', labelKey: 'paramTemperature', step: '0.1', min: '0', max: '2' },
  { key: 'maxTokens', labelKey: 'paramMaxTokens', step: '1', min: '1' },
  { key: 'topP', labelKey: 'paramTopP', step: '0.05', min: '0', max: '1' },
  { key: 'topK', labelKey: 'paramTopK', step: '1', min: '1' },
  { key: 'frequencyPenalty', labelKey: 'paramFreqPenalty', step: '0.1', min: '-2', max: '2' },
  { key: 'presencePenalty', labelKey: 'paramPresencePenalty', step: '0.1', min: '-2', max: '2' },
]

function parseNum(raw: string): number | undefined {
  if (!raw.trim()) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

interface RoleInferenceFieldsProps {
  value?: InferenceParamsForm
  onChange: (next: InferenceParamsForm | undefined) => void
}

export const RoleInferenceFields: React.FC<RoleInferenceFieldsProps> = ({ value, onChange }) => {
  const { t } = useTranslation('config')

  const updateField = (key: keyof InferenceParamsForm, raw: string) => {
    const nextRole = { ...(value ?? {}) }
    const parsed = parseNum(raw)
    if (parsed === undefined) {
      delete nextRole[key]
    } else {
      nextRole[key] = parsed
    }
    onChange(Object.keys(nextRole).length > 0 ? nextRole : undefined)
  }

  const inputClass =
    'w-full rounded-md border border-(--border-main) bg-(--bg-input) px-2.5 py-2 font-mono text-sm text-(--text-input) focus:outline-none focus:border-sky-500'

  return (
    <div className="grid grid-cols-2 gap-3">
      {PARAM_FIELDS.map((field) => (
        <div key={field.key}>
          <Label className="mb-1.5 block font-medium">{t(field.labelKey)}</Label>
          <input
            type="number"
            step={field.step}
            min={field.min}
            max={field.max}
            className={inputClass}
            value={value?.[field.key] ?? ''}
            onChange={(e) => updateField(field.key, e.target.value)}
            placeholder={t('paramPlaceholder')}
          />
        </div>
      ))}
    </div>
  )
}
