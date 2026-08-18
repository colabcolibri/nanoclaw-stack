import React from 'react'
import { X, Search, Check, Copy } from 'lucide-react'
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
  const [copied, setCopied] = React.useState<boolean>(false)

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
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-[var(--bg-card)] border-l border-[var(--border-main)] shadow-2xl p-6 flex flex-col z-10 overflow-y-auto animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between border-b border-[var(--border-main)] pb-4 mb-5">
          <h3 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
            <Search className="w-4 h-4 text-[var(--accent)]" />
            <span>Detalhes Técnicos da Mensagem</span>
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
              <span className="text-[var(--text-main)] font-semibold select-all">
                {message.id}
              </span>
            </div>

            <div>
              <span className="text-[var(--text-dim)] block uppercase font-bold text-[10px]">
                Canal
              </span>
              <Badge variant="secondary">{message.channel}</Badge>
            </div>

            <div>
              <span className="text-[var(--text-dim)] block uppercase font-bold text-[10px]">
                Remetente
              </span>
              <span className="text-[var(--text-main)]">{message.senderName}</span>
            </div>

            <div>
              <span className="text-[var(--text-dim)] block uppercase font-bold text-[10px]">
                Data & Hora
              </span>
              <span className="text-[var(--text-main)]">
                {new Date(message.timestamp).toLocaleString('pt-BR')}
              </span>
            </div>

            {message.memo && (
              <div>
                <span className="text-[var(--text-dim)] block uppercase font-bold text-[10px] mb-1">
                  Memo de Contexto (≤ 300 chars)
                </span>
                <div className="p-3 rounded-lg bg-[var(--accent-subtle)]/15 border border-[var(--accent)]/30 text-[var(--text-main)] font-sans text-xs leading-relaxed">
                  {message.memo}
                </div>
              </div>
            )}

            <div>
              <span className="text-[var(--text-dim)] block uppercase font-bold text-[10px]">
                Métricas de Consumo
              </span>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="p-2 rounded-lg bg-[var(--bg-card-subtle)] border border-[var(--border-main)] text-[var(--text-main)]">
                  <span className="text-[10px] text-[var(--text-dim)] block">Caracteres</span>
                  <span className="font-bold">{message.charCount || message.text?.length || 0}</span>
                </div>
                <div className="p-2 rounded-lg bg-[var(--bg-card-subtle)] border border-[var(--border-main)] text-[var(--text-main)]">
                  <span className="text-[10px] text-[var(--text-dim)] block">Tokens</span>
                  <span className="font-bold">{message.tokens || 0}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[var(--text-dim)] uppercase font-bold text-[10px]">
                  Raw Payload JSON
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyRaw}
                  className="h-6 px-2 text-[10px] gap-1 text-[var(--accent)]"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </Button>
              </div>
              <pre className="p-3 bg-[var(--terminal-bg)] text-[var(--terminal-text)] border border-[var(--border-main)] rounded-xl text-[11px] overflow-x-auto max-h-60">
                {JSON.stringify(message, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <div className="text-[var(--text-dim)] text-xs">
            Nenhuma mensagem selecionada.
          </div>
        )}
      </div>
    </div>
  )
}
