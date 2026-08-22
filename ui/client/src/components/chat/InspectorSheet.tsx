import React from 'react'
import { useTranslation } from 'react-i18next'
import { Braces, Check, Copy } from 'lucide-react'
import { type ChatMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

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
  const { t } = useTranslation('chat')
  const [copied, setCopied] = React.useState(false)

  const handleCopyRaw = async () => {
    if (!message) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(message, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b border-[var(--border-main)] pb-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Braces className="h-4 w-4 text-[var(--accent)]" />
            {t('inspectorTitle')}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {t('inspectorSubtitle')}
          </SheetDescription>
        </SheetHeader>

        {message ? (
          <div className="mt-5 space-y-5 text-xs">
            <Field label={t('messageId')} mono>
              {message.id}
            </Field>

            {message.model && (
              <Field label={t('messageModel')} mono>
                {message.model}
              </Field>
            )}

            <Field label={t('messageChannel')}>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {message.channel}
              </Badge>
            </Field>

            <Field label={t('messageSender')}>{message.senderName}</Field>

            <Field label={t('messageTimestamp')}>
              {new Date(message.timestamp).toLocaleString('pt-BR')}
            </Field>

            {message.memo && (
              <div>
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[var(--text-dim)]">
                  Memo
                </span>
                <p className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent-subtle)] p-3 text-xs leading-relaxed text-[var(--text-main)]">
                  {message.memo}
                </p>
              </div>
            )}

            <div>
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-[var(--text-dim)]">
                {t('tokens')}
              </span>
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label={t('metricChars')} value={message.charCount || message.text?.length || 0} />
                <MetricCard label={t('metricTokens')} value={message.tokens || 0} />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-dim)]">
                  {t('messageRaw')}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyRaw}
                  className="h-7 gap-1 px-2 text-[10px]"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copied ? t('copied') : t('copy')}
                </Button>
              </div>
              <pre className="max-h-72 overflow-auto rounded-lg border border-[var(--border-main)] bg-[var(--terminal-bg)] p-3 font-mono text-[11px] leading-relaxed text-[var(--terminal-text)]">
                {JSON.stringify(message, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-[var(--text-muted)]">{t('inspectorEmpty')}</p>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Field({
  label,
  children,
  mono,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div>
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[var(--text-dim)]">
        {label}
      </span>
      <div className={mono ? 'select-all font-mono text-[var(--text-main)]' : 'text-[var(--text-main)]'}>
        {children}
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border-main)] bg-[var(--bg-card-subtle)] p-2.5">
      <span className="block text-[10px] text-[var(--text-dim)]">{label}</span>
      <span className="font-mono text-sm font-semibold text-[var(--text-main)]">
        {value.toLocaleString('pt-BR')}
      </span>
    </div>
  )
}
