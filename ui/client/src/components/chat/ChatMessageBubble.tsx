import React, { useState } from 'react'
import { Copy, Check, Search, Bot, User, Send, Laptop, Terminal, Globe } from 'lucide-react'
import { type ChatMessage } from '@/api/client'
import { parseMarkdown } from '@/lib/markdown'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface ChatMessageBubbleProps {
  message: ChatMessage
  onInspect: (msg: ChatMessage) => void
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message,
  onInspect,
}) => {
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

  const getChannelBadge = (ch: string) => {
    switch (ch?.toLowerCase()) {
      case 'macos':
        return (
          <Badge variant="macos">
            <Laptop className="w-3 h-3" />
            <span>macOS</span>
          </Badge>
        )
      case 'telegram':
        return (
          <Badge variant="telegram">
            <Send className="w-3 h-3" />
            <span>Telegram</span>
          </Badge>
        )
      case 'cli':
        return (
          <Badge variant="cli">
            <Terminal className="w-3 h-3" />
            <span>Terminal</span>
          </Badge>
        )
      default:
        return (
          <Badge variant="web">
            <Globe className="w-3 h-3" />
            <span>{ch || 'Web'}</span>
          </Badge>
        )
    }
  }

  const renderedContent = parseMarkdown(message.text || '')

  return (
    <div
      className={`flex flex-col gap-2 transition-all ${
        isUser ? 'items-end' : 'items-start'
      } max-w-4xl w-full mx-auto`}
    >
      {/* Author and Metadata Header */}
      <div className={`flex items-center gap-2.5 px-1 text-xs font-semibold ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-xs ${
            isUser
              ? 'bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)]'
              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
          }`}
        >
          {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-4 h-4" />}
        </div>
        <span className={isUser ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-main)] font-bold'}>
          {isUser ? (message.senderName || 'Você') : 'Barão'}
        </span>
        <span className="text-[11px] font-mono text-[var(--text-dim)] font-normal">
          {timeStr}
        </span>
        <div>{getChannelBadge(message.channel)}</div>
      </div>

      {/* Message Bubble Body */}
      <div
        className={`relative p-4 sm:p-5 rounded-2xl border text-xs sm:text-sm shadow-xs transition-colors ${
          isUser
            ? 'bg-[var(--bg-card)] border-[var(--border-main)] rounded-tr-sm text-[var(--text-main)] max-w-2xl'
            : 'bg-[var(--bg-card-subtle)] border-[var(--border-main)] rounded-tl-sm text-[var(--text-main)] w-full'
        }`}
      >
        <div
          className="prose-rendered leading-relaxed break-words"
          dangerouslySetInnerHTML={{ __html: renderedContent }}
        />

        {/* Message Actions / Token Footer */}
        <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-[var(--border-main)] text-[11px] text-[var(--text-dim)] font-mono">
          <div className="flex items-center gap-2">
            {message.tokens ? (
              <span>~{message.tokens.toLocaleString()} tokens</span>
            ) : null}
            {message.costUsd ? (
              <span className="text-[var(--accent)] font-semibold">
                ${message.costUsd.toFixed(4)}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] gap-1 text-[var(--text-muted)] hover:text-[var(--text-main)]"
              onClick={handleCopy}
              title="Copiar mensagem"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copiar</span>
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] gap-1 text-[var(--text-muted)] hover:text-[var(--accent)]"
              onClick={() => onInspect(message)}
              title="Ver detalhes técnicos"
            >
              <Search className="w-3 h-3" />
              <span>Inspecionar</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
