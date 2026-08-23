import { type ChatThread } from '@/api/client'
import {
  channelAccentClass,
  formatRelativeTime,
  formatThreadChannelLabel,
  formatThreadSubject,
} from '@/components/chat/thread-utils'
import { cn } from '@/lib/utils'
import { Archive } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

interface ThreadListItemProps {
  thread: ChatThread
  isActive: boolean
  onSelect: () => void
}

export const ThreadListItem: React.FC<ThreadListItemProps> = ({ thread, isActive, onSelect }) => {
  const { t } = useTranslation('chat')
  const isArchived = thread.status === 'archived' || thread.status === 'closed'
  const channelLabel = formatThreadChannelLabel(thread.channel)
  const subject = formatThreadSubject(thread)
  const timeLabel = formatRelativeTime(thread.lastActiveAt)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full min-w-0 gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition-colors',
        isActive
          ? 'border-primary/40 bg-primary/8 shadow-xs'
          : 'border-transparent bg-transparent hover:border-(--border-main) hover:bg-(--bg-card-subtle)',
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase',
          channelAccentClass(thread.channel),
        )}
        aria-hidden
      >
        {channelLabel.slice(0, 2)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-semibold leading-tight text-(--text-main)">
            {subject}
          </p>
          {timeLabel && (
            <span className="shrink-0 text-[10px] font-medium tabular-nums text-(--text-dim)">
              {timeLabel}
            </span>
          )}
        </div>

        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="max-w-22 truncate text-[11px] text-(--text-dim) sm:max-w-none">
            {channelLabel}
          </span>
          {isArchived ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-(--bg-card-subtle) px-1 py-px text-[10px] font-medium leading-none text-(--text-dim)">
              <Archive className="h-2.5 w-2.5" />
              {t('threadArchived')}
            </span>
          ) : (
            <span className="shrink-0 rounded-md bg-emerald-500/10 px-1 py-px text-[10px] font-medium leading-none text-emerald-700 dark:text-emerald-400">
              {t('threadActive')}
            </span>
          )}
          {thread.messageCount > 0 && (
            <span className="shrink-0 rounded-md border border-(--border-main) px-1 py-px font-mono text-[10px] leading-none text-(--text-dim)">
              {t('threadMessageCount', { count: thread.messageCount })}
            </span>
          )}
        </div>

        <p className="mt-1 line-clamp-2 text-xs leading-snug text-(--text-muted)">
          {thread.lastPreview || t('threadEmpty')}
        </p>
      </div>
    </button>
  )
}
