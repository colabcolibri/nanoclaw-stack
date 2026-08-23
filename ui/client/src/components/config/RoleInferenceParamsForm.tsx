import React from 'react'
import { cn } from '@/lib/utils'

export type InferenceRole = 'orchestrator' | 'worker' | 'sender' | 'memo'

export interface InferenceParamsForm {
  temperature?: number
  maxTokens?: number
  topP?: number
  topK?: number
  frequencyPenalty?: number
  presencePenalty?: number
}

export type RoleInferenceParamsState = Partial<Record<InferenceRole, InferenceParamsForm>>

const ROLE_META: Record<
  InferenceRole,
  { label: string; accent: string }
> = {
  orchestrator: { label: 'Orquestrador', accent: 'text-purple-500' },
  worker: { label: 'Worker', accent: 'text-sky-500' },
  sender: { label: 'Sender', accent: 'text-emerald-500' },
  memo: { label: 'Memo', accent: 'text-amber-500' },
}

const PARAM_FIELDS: Array<{
  key: keyof InferenceParamsForm
  label: string
  step?: string
  min?: string
  max?: string
}> = [
  { key: 'temperature', label: 'Temperature', step: '0.1', min: '0', max: '2' },
  { key: 'maxTokens', label: 'Max tokens', step: '1', min: '1' },
  { key: 'topP', label: 'Top P', step: '0.05', min: '0', max: '1' },
  { key: 'topK', label: 'Top K', step: '1', min: '1' },
  { key: 'frequencyPenalty', label: 'Freq. penalty', step: '0.1', min: '-2', max: '2' },
  { key: 'presencePenalty', label: 'Presence penalty', step: '0.1', min: '-2', max: '2' },
]

function parseNum(raw: string): number | undefined {
  if (!raw.trim()) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

interface RoleInferenceParamsFormProps {
  value: RoleInferenceParamsState
  onChange: (next: RoleInferenceParamsState) => void
}

export const RoleInferenceParamsForm: React.FC<RoleInferenceParamsFormProps> = ({ value, onChange }) => {
  const updateField = (role: InferenceRole, key: keyof InferenceParamsForm, raw: string) => {
    const nextRole = { ...(value[role] ?? {}) }
    const parsed = parseNum(raw)
    if (parsed === undefined) {
      delete nextRole[key]
    } else {
      nextRole[key] = parsed
    }
    const next = { ...value }
    if (Object.keys(nextRole).length === 0) {
      delete next[role]
    } else {
      next[role] = nextRole
    }
    onChange(next)
  }

  const inputClass =
    'w-full rounded-md border border-(--border-main) bg-(--bg-input) px-2 py-1.5 font-mono text-[11px] text-(--text-input) focus:outline-none focus:border-sky-500'

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {(Object.keys(ROLE_META) as InferenceRole[]).map((role) => {
          const meta = ROLE_META[role]
          const hasOverrides = Boolean(value[role] && Object.keys(value[role]!).length > 0)
          return (
            <div
              key={role}
              className="rounded-xl border border-(--border-main) bg-(--bg-card-subtle)/30 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className={cn('text-[10px] font-bold uppercase tracking-wider', meta.accent)}>
                  {meta.label}
                </span>
                {hasOverrides && (
                  <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[9px] font-semibold text-sky-600 dark:text-sky-300">
                    custom
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PARAM_FIELDS.map((field) => (
                  <div key={field.key}>
                    <label className="mb-0.5 block text-[10px] text-(--text-dim)">{field.label}</label>
                    <input
                      type="number"
                      step={field.step}
                      min={field.min}
                      max={field.max}
                      className={inputClass}
                      value={value[role]?.[field.key] ?? ''}
                      onChange={(e) => updateField(role, field.key, e.target.value)}
                      placeholder="padrão"
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[11px] leading-relaxed text-(--text-dim)">
        Campos vazios usam o padrão do catálogo (provider + modelo). Overrides por papel sobrescrevem só
        naquele papel.
      </p>
    </div>
  )
}
