import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, MessageSquare, RefreshCw } from 'lucide-react'
import { type ChatMessage, type ChatThread } from '@/api/client'
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble'
import { EmptyState } from '@/components/common/EmptyState'
import {
  channelAccentClass,
  formatRelativeTime,
  formatThreadChannelLabel,
  formatThreadSubject,
  formatThreadTitle,
} from '@/components/chat/thread-utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface ChatConversationPanelProps {
  thread: ChatThread | null
  messages: ChatMessage[]
  currency?: 'BRL' | 'USD'
  isLoading: boolean
  onInspectMessage: (msg: ChatMessage) => void
  onBack?: () => void
  showBackButton?: boolean
  onRefresh: () => void
  className?: string
}

export const ChatConversationPanel: React.FC<ChatConversationPanelProps> = ({
  thread,
  messages,
  currency = 'BRL',
  isLoading,
  onInspectMessage,
  onBack,
  showBackButton = false,
  onRefresh,
  className,
}) => {
  const { t } = useTranslation('chat')
  const topRef = useRef<HTMLDivElement>(null)

  const sortedMessages = [...messages].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )

  useEffect(() => {
    if (!isLoading && sortedMessages.length > 0) {
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [thread?.sessionId, isLoading, sortedMessages.length])

  return (
    <section className={cn('flex min-h-0 min-w-0 flex-1 flex-col bg-(--bg-card)', className)}>
      {thread ? (
        <header className="flex shrink-0 items-center gap-3 border-b border-(--border-main) px-4 py-3 sm:px-5">
          {showBackButton && onBack && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 md:hidden" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase',
              channelAccentClass(thread.channel),
            )}
          >
            {formatThreadChannelLabel(thread.channel).slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-(--text-main)">
              {formatThreadSubject(thread)}
            </h3>
            <p className="truncate text-[11px] text-(--text-dim)">
              {formatThreadTitle(thread)}
              {thread.lastActiveAt ? ` · ${formatRelativeTime(thread.lastActiveAt)}` : ''}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-8 shrink-0 gap-1.5 text-xs"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            <span className="hidden sm:inline">{t('refresh')}</span>
          </Button>
        </header>
      ) : (
        <header className="shrink-0 border-b border-(--border-main) px-4 py-3 sm:px-5">
          <p className="text-sm font-semibold text-(--text-main)">{t('feedTitle')}</p>
          <p className="text-[11px] text-(--text-dim)">{t('feedSubtitle')}</p>
        </header>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
        {!thread ? (
          <EmptyState
            icon={<MessageSquare className="h-10 w-10 text-(--text-dim)" />}
            title={t('selectThreadTitle')}
            description={t('selectThreadDescription')}
          />
        ) : isLoading && sortedMessages.length === 0 ? (
          <div className="mx-auto max-w-3xl space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-6 w-32 rounded-md" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : sortedMessages.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-8 w-8 text-(--text-dim)" />}
            title={t('emptyTitle')}
            description={t('noMessages')}
            action={
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
                <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', isLoading && 'animate-spin')} />
                {t('refresh')}
              </Button>
            }
          />
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            <div ref={topRef} className="h-1 shrink-0" aria-hidden />
            {sortedMessages.map((m) => (
              <ChatMessageBubble
                key={m.id}
                message={m}
                currency={currency}
                onInspect={onInspectMessage}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
