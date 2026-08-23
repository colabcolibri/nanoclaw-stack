import type { ChatThread } from '@/api/client'
import {
  pickDefaultSessionId,
  resolveSelectedSessionId,
} from '@shared/thread-selection'

export type ThreadFilter = 'all' | 'active' | 'archived'

/** @deprecated Use pickDefaultSessionId from @shared/thread-selection */
export function pickDefaultThreadId(threads: ChatThread[]): string | null {
  return pickDefaultSessionId(threads)
}

export { resolveSelectedSessionId }

export function formatThreadSubject(thread: ChatThread): string {
  if (thread.threadId) {
    const colon = thread.threadId.indexOf(':')
    if (colon >= 0 && colon < thread.threadId.length - 1) {
      return thread.threadId.slice(colon + 1)
    }
    return thread.threadId
  }
  return thread.sessionId.replace(/^sess-/, '').slice(0, 12)
}

export function formatThreadChannelLabel(channel: string): string {
  const labels: Record<string, string> = {
    macos: 'macOS',
    ios: 'iOS',
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
    web: 'Web',
    api: 'API',
    discord: 'Discord',
    slack: 'Slack',
    cli: 'Terminal',
  }
  return labels[channel] ?? channel
}

export function formatThreadTitle(thread: ChatThread): string {
  const channel = formatThreadChannelLabel(thread.channel)
  const subject = formatThreadSubject(thread)
  return `${channel} · ${subject}`
}

export function formatRelativeTime(iso: string | null, locale = 'pt-BR'): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHr = Math.floor(diffMs / 3_600_000)
  const diffDay = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin} min`
  if (diffHr < 24) return `${diffHr}h`
  if (diffDay < 7) return `${diffDay}d`

  return date.toLocaleDateString(locale, { day: '2-digit', month: 'short' })
}

export function filterThreads(
  threads: ChatThread[],
  query: string,
  statusFilter: ThreadFilter,
): ChatThread[] {
  const q = query.trim().toLowerCase()
  return threads.filter((thread) => {
    if (statusFilter === 'active' && thread.status !== 'active') return false
    if (statusFilter === 'archived' && thread.status === 'active') return false
    if (!q) return true
    const haystack = [
      thread.threadId,
      thread.sessionId,
      thread.channel,
      formatThreadChannelLabel(thread.channel),
      formatThreadSubject(thread),
      thread.lastPreview,
      thread.lastSenderName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function channelAccentClass(channel: string): string {
  const map: Record<string, string> = {
    macos: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    ios: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
    telegram: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    whatsapp: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    web: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    api: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    discord: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
    slack: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400',
  }
  return map[channel] ?? 'bg-(--bg-card-subtle) text-(--text-muted)'
}
