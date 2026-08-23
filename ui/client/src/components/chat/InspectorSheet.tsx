import React from 'react'
import { useTranslation } from 'react-i18next'
import { Braces, Check, Copy } from 'lucide-react'
import { type ChatMessage } from '@/api/client'
import { ExpandableTextBlock } from '@/components/common/ExpandableTextBlock'
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

  const rawJson = message ? JSON.stringify(message, null, 2) : ''

  const handleCopyRaw = async () => {
    if (!message) return
    try {
      await navigator.clipboard.writeText(rawJson)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="flex h-dvh max-h-dvh w-full max-w-xl flex-col gap-0 overflow-hidden border-l border-(--border-main) bg-(--bg-card)/95 p-0 backdrop-blur-xl sm:max-w-xl"
      >
        <div className="flex h-full min-w-0 flex-col">
          <SheetHeader className="shrink-0 space-y-0 border-b border-(--border-main) bg-(--bg-card-subtle)/50 px-6 pb-5 pt-6">
            <div className="flex items-start gap-4 pr-8">
              <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-(--accent-border) bg-(--accent-subtle)">
                <Braces className="h-5 w-5 text-(--accent)" />
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="mb-1 text-lg leading-snug">
                  {t('inspectorTitle')}
                </SheetTitle>
                <SheetDescription className="text-xs leading-relaxed">
                  {t('inspectorSubtitle')}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-6">
            {message ? (
              <div className="space-y-6 text-xs">
                <section className="space-y-4">
                  <Field label={t('messageId')} mono>
                    <span className="break-all">{message.id}</span>
                  </Field>

                  {message.model && (
                    <Field label={t('messageModel')} mono>
                      <span className="break-all text-(--accent)">{message.model}</span>
                    </Field>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={t('messageChannel')}>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {message.channel}
                      </Badge>
                    </Field>
                    <Field label={t('messageSender')}>{message.senderName}</Field>
                  </div>

                  <Field label={t('messageTimestamp')}>
                    {new Date(message.timestamp).toLocaleString('pt-BR')}
                  </Field>
                </section>

                {message.memo && (
                  <section className="space-y-2">
                    <SectionLabel>Memo</SectionLabel>
                    <p className="rounded-xl border border-(--accent-border) bg-(--accent-subtle) p-3.5 text-xs leading-relaxed text-(--text-main) wrap-break-word">
                      {message.memo}
                    </p>
                  </section>
                )}

                <section className="space-y-2">
                  <SectionLabel>{t('tokens')}</SectionLabel>
                  <div className="grid grid-cols-2 gap-2.5">
                    <MetricCard label={t('metricChars')} value={message.charCount || message.text?.length || 0} />
                    <MetricCard label={t('metricTokens')} value={message.tokens || 0} />
                  </div>
                </section>

                <section className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <SectionLabel>{t('messageRaw')}</SectionLabel>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyRaw}
                      className="h-7 shrink-0 gap-1 px-2 text-[10px]"
                    >
                      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      {copied ? t('copied') : t('copy')}
                    </Button>
                  </div>
                  <ExpandableTextBlock
                    content={rawJson}
                    collapsedMaxHeight={280}
                    expandWhenLongerThan={400}
                    preClassName="border-(--border-main) bg-(--terminal-bg) p-3.5 text-[11px] text-(--terminal-text)"
                  />
                </section>
              </div>
            ) : (
              <p className="text-sm text-(--text-muted)">{t('inspectorEmpty')}</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] font-bold uppercase tracking-wide text-(--text-dim)">
      {children}
    </span>
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
      <SectionLabel>{label}</SectionLabel>
      <div
        className={
          mono
            ? 'mt-1.5 select-all font-mono text-(--text-main)'
            : 'mt-1.5 text-(--text-main)'
        }
      >
        {children}
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-(--border-main) bg-(--bg-card-subtle) p-3">
      <span className="block text-[10px] text-(--text-dim)">{label}</span>
      <span className="mt-0.5 block font-mono text-sm font-semibold text-(--text-main)">
        {value.toLocaleString('pt-BR')}
      </span>
    </div>
  )
}
