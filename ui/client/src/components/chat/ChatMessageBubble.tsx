import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Check, Braces, Bot, User, Send, Laptop, Terminal, Globe } from 'lucide-react'
import { type ChatMessage } from '@/api/client'
import { parseMarkdown } from '@/lib/markdown'
import { Button } from '@/components/ui/button'
import { ChannelBadge } from '@/components/templates/ChannelBadge'
import { cn } from '@/lib/utils'

interface ChatMessageBubbleProps {
  message: ChatMessage
  currency?: 'BRL' | 'USD'
  onInspect: (msg: ChatMessage) => void
}

function formatMessageCost(message: ChatMessage, currency: 'BRL' | 'USD'): string | null {
  if (currency === 'BRL' && message.costBrl != null) {
    return `R$ ${Number(message.costBrl).toFixed(3)}`
  }
  if (message.costUsd != null) {
    return currency === 'BRL'
      ? `R$ ${(message.costUsd * 5.2).toFixed(3)}`
      : `$${message.costUsd.toFixed(4)}`
  }
  return null
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message,
  currency = 'BRL',
  onInspect,
}) => {
  const { t } = useTranslation('chat')
  const [copied, setCopied] = useState(false)
  const isUser = message.type === 'user'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text || '')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const timeStr = new Date(message.timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const channelLabel = (() => {
    switch (message.channel?.toLowerCase()) {
      case 'macos':
        return 'macOS'
      case 'telegram':
        return 'Telegram'
      case 'cli':
        return 'Terminal'
      default:
        return message.channel || 'Web'
    }
  })()

  const getChannelBadge = (ch: string) => {
    switch (ch?.toLowerCase()) {
      case 'macos':
        return (
          <ChannelBadge channel="macos" className="h-5 gap-1 px-1.5 text-[10px] font-semibold">
            <Laptop className="h-3 w-3" />
            macOS
          </ChannelBadge>
        )
      case 'telegram':
        return (
          <ChannelBadge channel="telegram" className="h-5 gap-1 px-1.5 text-[10px] font-semibold">
            <Send className="h-3 w-3" />
            Telegram
          </ChannelBadge>
        )
      case 'cli':
        return (
          <ChannelBadge channel="cli" className="h-5 gap-1 px-1.5 text-[10px] font-semibold">
            <Terminal className="h-3 w-3" />
            Terminal
          </ChannelBadge>
        )
      default:
        return (
          <ChannelBadge channel="web" className="h-5 gap-1 px-1.5 text-[10px] font-semibold">
            <Globe className="h-3 w-3" />
            {ch || 'Web'}
          </ChannelBadge>
        )
    }
  }

  const renderedContent = parseMarkdown(message.text || '')
  const costLabel = formatMessageCost(message, currency)

  return (
    <article
      className={cn(
        'flex w-full flex-col gap-2',
        isUser ? 'items-end' : 'items-start'
      )}
    >
      <div
        className={cn(
          'flex max-w-full items-center gap-2 px-0.5 text-xs',
          isUser && 'flex-row-reverse'
        )}
      >
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
            isUser
              ? 'border-(--accent-border) bg-(--accent-subtle) text-primary'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
          )}
        >
          {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-4 w-4" />}
        </div>

        <div className={cn('min-w-0', isUser && 'text-right')}>
          <div
            className={cn(
              'flex flex-wrap items-center gap-x-2 gap-y-0.5',
              isUser && 'justify-end'
            )}
          >
            <span
              className={cn(
                'text-sm font-semibold',
                isUser ? 'text-primary' : 'text-(--text-main)'
              )}
            >
              {isUser ? message.senderName || t('you') : t('assistant')}
            </span>
            {getChannelBadge(message.channel)}
            <span className="font-mono text-[11px] font-normal text-(--text-dim)">
              {channelLabel} • {timeStr}
            </span>
          </div>
        </div>
      </div>

      <div
        className={cn(
          'rounded-xl border border-(--border-main) text-sm shadow-xs transition-colors',
          isUser
            ? 'max-w-xl bg-(--bg-card) text-(--text-main)'
            : 'w-full max-w-none bg-(--bg-card-subtle) text-(--text-main)'
        )}
      >
        <div
          className="prose-rendered wrap-break-word px-4 py-3.5 leading-relaxed sm:px-5 sm:py-4"
          dangerouslySetInnerHTML={{ __html: renderedContent }}
        />

        <div className="flex items-center justify-between gap-3 border-t border-(--border-main) px-3 py-2 sm:px-4">
          <p className="font-mono text-[11px] text-(--text-dim)">
            {message.tokens ? (
              <>
                {t('tokenLabel', { count: message.tokens.toLocaleString('pt-BR') })}
                {costLabel ? ` • ${costLabel}` : ''}
              </>
            ) : (
              costLabel || '—'
            )}
          </p>

          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-(--text-muted) hover:text-(--text-main)"
              onClick={handleCopy}
              title={t('copy')}
              aria-label={t('copy')}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-(--text-muted) hover:text-primary"
              onClick={() => onInspect(message)}
              title={t('inspect')}
              aria-label={t('inspect')}
            >
              <Braces className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  )
}
