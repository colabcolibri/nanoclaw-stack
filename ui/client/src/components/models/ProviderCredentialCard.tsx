import React from 'react'
import { KeyRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface ProviderCredentialCardProps {
  providerId: string
  name: string
  envName?: string
  hasKey: boolean
  maskedKey?: string
  newKeyValue: string
  onNewKeyChange: (value: string) => void
  onSave: () => void
  isSaving: boolean
}

export const ProviderCredentialCard: React.FC<ProviderCredentialCardProps> = ({
  name,
  envName,
  hasKey,
  maskedKey,
  newKeyValue,
  onNewKeyChange,
  onSave,
  isSaving,
}) => {
  return (
    <article
      className={cn(
        'flex min-w-0 flex-col rounded-xl border border-(--border-main) bg-(--bg-card) p-5 transition-colors',
        'hover:bg-(--bg-card-subtle)/40'
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-400"
          >
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-snug text-(--text-main) wrap-break-word">
              {name}
            </h3>
            <p className="mt-0.5 font-mono text-[10px] text-(--text-dim) truncate">
              {envName ?? '—'}
            </p>
          </div>
        </div>
        <Badge
          variant={hasKey ? 'success' : 'outline'}
          className="shrink-0 text-[10px] font-semibold"
        >
          {hasKey ? 'Configurado' : 'Ausente'}
        </Badge>
      </div>

      {hasKey && maskedKey && (
        <p className="mt-3 rounded-md border border-(--border-main) bg-(--bg-input) px-3 py-2 font-mono text-[10px] text-(--text-muted) truncate">
          {maskedKey}
        </p>
      )}

      <div className="mt-4 space-y-2 border-t border-(--border-main)/60 pt-4">
        <Label htmlFor={`key-${envName}`} className="text-[10px] font-bold uppercase tracking-wide text-(--text-dim)">
          Nova API key
        </Label>
        <div className="flex min-w-0 gap-2">
          <Input
            id={`key-${envName}`}
            type="password"
            placeholder="sk-..."
            value={newKeyValue}
            onChange={(e) => onNewKeyChange(e.target.value)}
            className="min-w-0 font-mono text-xs"
          />
          <Button
            type="button"
            size="sm"
            disabled={!newKeyValue.trim() || isSaving}
            onClick={onSave}
            className="h-9 shrink-0 text-xs font-semibold"
          >
            {isSaving ? '...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </article>
  )
}
