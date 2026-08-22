import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, RefreshCw } from 'lucide-react'
import { type ChatMessage, type SystemStats } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ChannelFilterBar } from '@/components/chat/ChannelFilterBar'
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble'
import { ChatStatsRow } from '@/components/chat/ChatStatsRow'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

interface ChatViewProps {
  messages: ChatMessage[]
  stats: SystemStats | null
  currency?: 'BRL' | 'USD'
  isLoading: boolean
  onRefresh: () => void
  onInspectMessage: (msg: ChatMessage) => void
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  stats,
  currency = 'BRL',
  isLoading,
  onRefresh,
  onInspectMessage,
}) => {
  const { t } = useTranslation('chat')
  const [filterChannel, setFilterChannel] = useState<string>('all')

  const sortedMessages = [...messages].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  const filteredMessages = sortedMessages.filter((m) => {
    if (filterChannel === 'all') return true
    return m.channel === filterChannel
  })

  const showInitialSkeleton = isLoading && messages.length === 0

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-5">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <ChannelFilterBar
              activeChannel={filterChannel}
              onSelectChannel={setFilterChannel}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-8 shrink-0 gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{t('refresh')}</span>
            </Button>
          </div>
        }
      />

      <ChatStatsRow stats={stats} currency={currency} />

      <Card className="flex min-h-0 flex-1 flex-col border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs">
        <CardContent className="flex min-h-[min(70dvh,42rem)] flex-1 flex-col p-0">
          <div className="flex items-center justify-between border-b border-[var(--border-main)] px-4 py-3 sm:px-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {t('feedTitle')}
              </p>
              <p className="text-[11px] text-[var(--text-dim)]">{t('feedSubtitle')}</p>
            </div>
            {!showInitialSkeleton && filteredMessages.length > 0 && (
              <span className="rounded-md border border-[var(--border-main)] bg-[var(--bg-card-subtle)] px-2 py-1 font-mono text-[10px] text-[var(--text-dim)]">
                {t('messageCount', { count: filteredMessages.length })}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
            {showInitialSkeleton ? (
              <div className="space-y-5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-8 w-48 rounded-lg" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                  </div>
                ))}
              </div>
            ) : filteredMessages.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="h-8 w-8 text-[var(--text-dim)]" />}
                title={t('emptyTitle')}
                description={t('noMessages')}
                action={
                  <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    {t('refresh')}
                  </Button>
                }
              />
            ) : (
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
                {filteredMessages.map((m) => (
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
        </CardContent>
      </Card>
    </div>
  )
}
