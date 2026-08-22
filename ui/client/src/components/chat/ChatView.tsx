import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, RefreshCw, ArrowDownUp } from 'lucide-react'
import { type ChatMessage } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ChannelFilterBar } from '@/components/chat/ChannelFilterBar'
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble'
import { Button } from '@/components/ui/button'

interface ChatViewProps {
  messages: ChatMessage[]
  isLoading: boolean
  onRefresh: () => void
  onInspectMessage: (msg: ChatMessage) => void
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  isLoading,
  onRefresh,
  onInspectMessage,
}) => {
  const { t } = useTranslation('chat')
  const [filterChannel, setFilterChannel] = useState<string>('all')

  // Always show newest/most recent messages at the TOP
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  const filteredMessages = sortedMessages.filter((m) => {
    if (filterChannel === 'all') return true
    return m.channel === filterChannel
  })

  return (
    <div className="flex flex-col flex-1 gap-4 w-full min-h-0">
      {/* Reusable PageHeader Template */}
      <PageHeader
        title={t('title')}
        subtitle="Histórico ordenado das interações com o Barão (mais recentes no topo)."
        actions={
          <>
            <ChannelFilterBar
              activeChannel={filterChannel}
              onSelectChannel={setFilterChannel}
            />

            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </Button>
          </>
        }
      />

      {/* Real Chat Message Stream - Newest at the top */}
      <div className="flex-1 min-h-0 p-4 sm:p-5 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] shadow-[var(--shadow-card)] overflow-y-auto space-y-5">
        {filteredMessages.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="w-8 h-8 text-[var(--text-dim)]" />}
            title="Nenhuma mensagem"
            description={t('noMessages')}
          />
        ) : (
          filteredMessages.map((m) => (
            <ChatMessageBubble
              key={m.id}
              message={m}
              onInspect={onInspectMessage}
            />
          ))
        )}
      </div>
    </div>
  )
}
