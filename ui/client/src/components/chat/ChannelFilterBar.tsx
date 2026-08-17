import React from 'react'
import { useTranslation } from 'react-i18next'
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
    { id: 'all', label: t('filterAll') },
    { id: 'telegram', label: t('filterTelegram') },
    { id: 'macos', label: t('filterMacos') },
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
            className="h-7 text-xs px-3 font-semibold transition-all"
            onClick={() => onSelectChannel(ch.id)}
          >
            {ch.label}
          </Button>
        )
      })}
    </div>
  )
}
