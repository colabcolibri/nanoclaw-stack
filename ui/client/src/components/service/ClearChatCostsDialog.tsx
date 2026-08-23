import React, { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { ApiClient } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const CONFIRMATION_PHRASE = 'confirmar'

interface ClearChatCostsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export const ClearChatCostsDialog: React.FC<ClearChatCostsDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [confirmation, setConfirmation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setConfirmation('')
      setError(null)
      setIsSubmitting(false)
    }
  }, [open])

  const canSubmit = confirmation.trim().toLowerCase() === CONFIRMATION_PHRASE && !isSubmitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    setError(null)
    try {
      await ApiClient.purgeChatAndCosts(confirmation.trim())
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível limpar os dados.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-red-500/30">
        <DialogHeader className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-500">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Limpar chat e custos?</DialogTitle>
          <DialogDescription className="text-center text-xs leading-relaxed">
            Esta ação apaga permanentemente todas as mensagens de chat, o contexto das sessões ativas,
            sessões arquivadas e o histórico de custos/tokens. Configurações, canais, usuários e
            permissões não são alterados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="purge-confirmation" className="text-xs font-semibold text-(--text-main)">
            Digite <span className="font-mono text-red-500">{CONFIRMATION_PHRASE}</span> para continuar
          </label>
          <Input
            id="purge-confirmation"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={CONFIRMATION_PHRASE}
            autoComplete="off"
            spellCheck={false}
            disabled={isSubmitting}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit) void handleSubmit()
            }}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="text-xs font-semibold"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="text-xs font-bold"
          >
            {isSubmitting ? 'Limpando...' : 'Limpar tudo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
