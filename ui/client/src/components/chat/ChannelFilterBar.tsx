import React from 'react'
import { useTranslation } from 'react-i18next'
import { Layers, Send, Laptop } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChannelFilterBarProps {
  activeChannel: string
  onSelectChannel: (channel: string) => void
}

export const ChannelFilterBar: React.FC<ChannelFilterBarProps> = ({
  activeChannel,
  onSelectChannel,
}) => {
  const { t } = useTranslation('chat')

  const channels = [
    { id: 'all', label: t('filterAll'), icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'telegram', label: t('filterTelegram'), icon: <Send className="w-3.5 h-3.5" /> },
    { id: 'macos', label: t('filterMacos'), icon: <Laptop className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="flex p-1 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl gap-1 shadow-xs">
      {channels.map((ch) => {
        const isActive = activeChannel === ch.id
        return (
          <Button
            key={ch.id}
            variant={isActive ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs px-2.5 font-semibold transition-all gap-1.5"
            onClick={() => onSelectChannel(ch.id)}
          >
            {ch.icon}
            <span>{ch.label}</span>
          </Button>
        )
      })}
    </div>
  )
}
