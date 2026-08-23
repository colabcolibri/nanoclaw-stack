import React from 'react'

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

const ROLE_LABELS: Record<InferenceRole, string> = {
  orchestrator: 'Orquestrador',
  worker: 'Worker',
  sender: 'Sender',
  memo: 'Memo',
}

const PARAM_FIELDS: Array<{ key: keyof InferenceParamsForm; label: string; step?: string; min?: string; max?: string }> = [
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

  return (
    <div className="space-y-4">
      {(Object.keys(ROLE_LABELS) as InferenceRole[]).map((role) => (
        <div key={role} className="p-3 rounded-lg border border-(--border-main) bg-(--bg-card) space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-(--text-dim)">{ROLE_LABELS[role]}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {PARAM_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="block text-[10px] text-(--text-dim) mb-0.5">{field.label}</label>
                <input
                  type="number"
                  step={field.step}
                  min={field.min}
                  max={field.max}
                  className="w-full px-2 py-1.5 bg-(--bg-input) border border-(--border-main) rounded-md text-[11px] font-mono text-(--text-input) focus:outline-none focus:border-sky-500"
                  value={value[role]?.[field.key] ?? ''}
                  onChange={(e) => updateField(role, field.key, e.target.value)}
                  placeholder="padrão"
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-[10px] text-(--text-dim)">
        Campos vazios usam o padrão do catálogo (provider + modelo). Overrides por papel sobrescrevem só naquele papel.
      </p>
    </div>
  )
}
