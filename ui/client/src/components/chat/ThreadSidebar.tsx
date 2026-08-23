import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, RefreshCw } from 'lucide-react'
import { type ChatThread } from '@/api/client'
import { ThreadListItem } from '@/components/chat/ThreadListItem'
import { filterThreads, type ThreadFilter } from '@/components/chat/thread-utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface ThreadSidebarProps {
  threads: ChatThread[]
  activeSessionId: string | null
  isLoading: boolean
  onSelectThread: (sessionId: string) => void
  onRefresh: () => void
  className?: string
}

const FILTERS: ThreadFilter[] = ['all', 'active', 'archived']

export const ThreadSidebar: React.FC<ThreadSidebarProps> = ({
  threads,
  activeSessionId,
  isLoading,
  onSelectThread,
  onRefresh,
  className,
}) => {
  const { t } = useTranslation('chat')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ThreadFilter>('all')

  const filtered = useMemo(
    () => filterThreads(threads, query, statusFilter),
    [threads, query, statusFilter],
  )

  const activeThreads = filtered.filter((th) => th.status === 'active')
  const archivedThreads = filtered.filter((th) => th.status !== 'active')

  const showSections = statusFilter === 'all' && !query.trim()

  return (
    <aside
      className={cn(
        'flex min-h-0 flex-col border-(--border-main) bg-(--bg-card-subtle)/40',
        className,
      )}
    >
      <div className="shrink-0 space-y-3 border-b border-(--border-main) p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-(--text-main)">{t('threadsTitle')}</h2>
            <p className="text-[11px] text-(--text-dim)">
              {t('threadsSidebarHint', { count: threads.length })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onRefresh}
            disabled={isLoading}
            aria-label={t('refresh')}
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--text-dim)" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('threadSearchPlaceholder')}
            className="h-9 border-(--border-main) bg-(--bg-card) pl-8 text-xs"
          />
        </div>

        <div className="flex gap-1 rounded-lg border border-(--border-main) bg-(--bg-card) p-1">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={cn(
                'flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors',
                statusFilter === filter
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-(--text-muted) hover:bg-(--bg-card-subtle) hover:text-(--text-main)',
              )}
            >
              {t(`threadFilter_${filter}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-15 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-(--text-dim)">{t('noThreads')}</p>
        ) : showSections ? (
          <div className="space-y-4">
            {activeThreads.length > 0 && (
              <section>
                <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wide text-(--text-dim)">
                  {t('threadSectionActive')}
                </p>
                <div className="space-y-1">
                  {activeThreads.map((thread) => (
                    <ThreadListItem
                      key={thread.sessionId}
                      thread={thread}
                      isActive={activeSessionId === thread.sessionId}
                      onSelect={() => onSelectThread(thread.sessionId)}
                    />
                  ))}
                </div>
              </section>
            )}
            {archivedThreads.length > 0 && (
              <section>
                <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wide text-(--text-dim)">
                  {t('threadSectionArchived')}
                </p>
                <div className="space-y-1">
                  {archivedThreads.map((thread) => (
                    <ThreadListItem
                      key={thread.sessionId}
                      thread={thread}
                      isActive={activeSessionId === thread.sessionId}
                      onSelect={() => onSelectThread(thread.sessionId)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((thread) => (
              <ThreadListItem
                key={thread.sessionId}
                thread={thread}
                isActive={activeSessionId === thread.sessionId}
                onSelect={() => onSelectThread(thread.sessionId)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
