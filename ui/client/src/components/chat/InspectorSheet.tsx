import React from 'react'
import { X, Copy, Check } from 'lucide-react'
import { type ChatMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface InspectorSheetProps {
  isOpen: boolean
  onClose: () => void
  message: ChatMessage | null
}

export const InspectorSheet: React.FC<InspectorSheetProps> = ({
  isOpen,
  onClose,
  message,
}) => {
  const [copied, setCopied] = React.useState(false)

  if (!isOpen) return null

  const handleCopyRaw = async () => {
    if (!message) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(message, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-[var(--bg-card)] border-l border-[var(--border-main)] shadow-2xl p-6 flex flex-col z-10 overflow-y-auto animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between border-b border-[var(--border-main)] pb-4 mb-5">
          <h3 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
            <span>🔍 Detalhes Técnicos da Mensagem</span>
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="w-8 h-8 p-0 text-[var(--text-muted)] hover:text-[var(--text-main)]"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {message ? (
          <div className="space-y-4 text-xs font-mono">
            <div>
              <span className="text-[var(--text-dim)] block uppercase font-bold text-[10px]">
                ID da Mensagem
              </span>
              <span className="text-[var(--text-main)] break-all font-semibold">{message.id}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[var(--text-dim)] block uppercase font-bold text-[10px]">
                  Tipo
                </span>
                <Badge variant={message.type === 'user' ? 'default' : 'success'}>
                  {message.type.toUpperCase()}
                </Badge>
              </div>
              <div>
                <span className="text-[var(--text-dim)] block uppercase font-bold text-[10px]">
                  Canal
                </span>
                <span className="text-[var(--text-main)] font-semibold">{message.channel}</span>
              </div>
            </div>

            <div>
              <span className="text-[var(--text-dim)] block uppercase font-bold text-[10px]">
                Remetente
              </span>
              <span className="text-[var(--text-main)] font-bold">{message.senderName || 'Você'}</span>
            </div>

            <div>
              <span className="text-[var(--text-dim)] block uppercase font-bold text-[10px]">
                Timestamp
              </span>
              <span className="text-[var(--text-muted)]">{new Date(message.timestamp).toLocaleString('pt-BR')}</span>
            </div>

            <div>
              <span className="text-[var(--text-dim)] block uppercase font-bold text-[10px] mb-1">
                Payload Completo
              </span>
              <pre className="p-3.5 bg-[var(--bg-card-subtle)] rounded-xl border border-[var(--border-main)] text-[11px] text-[var(--text-main)] overflow-x-auto max-h-60">
                {JSON.stringify(message, null, 2)}
              </pre>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyRaw}
              className="w-full gap-2 mt-4 text-xs font-semibold"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado para Clipboard' : 'Copiar JSON Bruto'}</span>
            </Button>
          </div>
        ) : (
          <div className="text-[var(--text-dim)] text-center py-10">Nenhuma mensagem selecionada.</div>
        )}
      </div>
    </div>
  )
}
