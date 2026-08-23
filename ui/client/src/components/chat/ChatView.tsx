import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { ApiClient, type ChatMessage, type ChatThread, type SystemStats } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { ChatConversationPanel } from '@/components/chat/ChatConversationPanel'
import { ThreadSidebar } from '@/components/chat/ThreadSidebar'
import { ChatStatsRow } from '@/components/chat/ChatStatsRow'
import { pickDefaultThreadId } from '@/components/chat/thread-utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ChatViewProps {
  stats: SystemStats | null
  currency?: 'BRL' | 'USD'
  onInspectMessage: (msg: ChatMessage) => void
}

export const ChatView: React.FC<ChatViewProps> = ({
  stats,
  currency = 'BRL',
  onInspectMessage,
}) => {
  const { t } = useTranslation('chat')
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoadingThreads, setIsLoadingThreads] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [mobileShowList, setMobileShowList] = useState(true)

  const loadThreads = useCallback(async () => {
    setIsLoadingThreads(true)
    try {
      const data = await ApiClient.getChatThreads(50)
      const list = data.threads || []
      setThreads(list)
      setSelectedSessionId((current) => {
        if (current && list.some((th) => th.sessionId === current)) return current
        return pickDefaultThreadId(list)
      })
    } catch {
      setThreads([])
      setSelectedSessionId(null)
    } finally {
      setIsLoadingThreads(false)
    }
  }, [])

  const loadMessages = useCallback(async (sessionId: string | null) => {
    if (!sessionId) {
      setMessages([])
      return
    }
    setIsLoadingMessages(true)
    try {
      const data = await ApiClient.getChatMessages(200, sessionId)
      setMessages(data.messages || [])
    } catch {
      setMessages([])
    } finally {
      setIsLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    void loadThreads()
  }, [loadThreads])

  useEffect(() => {
    void loadMessages(selectedSessionId)
  }, [selectedSessionId, loadMessages])

  const handleRefresh = () => {
    void loadThreads()
    if (selectedSessionId) void loadMessages(selectedSessionId)
  }

  const handleSelectThread = (sessionId: string) => {
    setSelectedSessionId(sessionId)
    setMobileShowList(false)
  }

  const selectedThread = threads.find((th) => th.sessionId === selectedSessionId) ?? null
  const isLoading = isLoadingThreads || isLoadingMessages

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-5">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-8 shrink-0 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            <span>{t('refresh')}</span>
          </Button>
        }
      />

      <ChatStatsRow stats={stats} currency={currency} />

      <Card className="flex min-h-[min(72dvh,44rem)] flex-1 overflow-hidden border-(--border-main) bg-(--bg-card) shadow-xs">
        <div className="flex min-h-0 w-full flex-1">
          <ThreadSidebar
            threads={threads}
            activeSessionId={selectedSessionId}
            isLoading={isLoadingThreads}
            onSelectThread={handleSelectThread}
            onRefresh={handleRefresh}
            className={cn(
              'w-full shrink-0 md:w-[min(100%,20rem)] lg:w-80',
              !mobileShowList && 'hidden md:flex',
            )}
          />

          <ChatConversationPanel
            thread={selectedThread}
            messages={messages}
            currency={currency}
            isLoading={isLoadingMessages}
            onInspectMessage={onInspectMessage}
            onRefresh={handleRefresh}
            showBackButton
            onBack={() => setMobileShowList(true)}
            className={cn(mobileShowList && 'hidden md:flex')}
          />
        </div>
      </Card>
    </div>
  )
}
