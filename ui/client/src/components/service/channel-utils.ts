import type { ConnectedChannelItem } from '@/api/client'

const CHANNEL_LABELS: Record<string, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  discord: 'Discord',
  slack: 'Slack',
  signal: 'Signal',
  imessage: 'iMessage',
  web: 'Web',
  macos: 'macOS',
  ios: 'iOS',
}

export function getChannelLabel(channelType: string): string {
  return CHANNEL_LABELS[channelType.toLowerCase()] || channelType
}

export function getChannelDisplayName(channel: ConnectedChannelItem): string {
  if (channel.name?.trim()) return channel.name.trim()

  const type = channel.channelType.toLowerCase()
  if (type === 'telegram') {
    return channel.isGroup ? 'Grupo Telegram' : 'DM Telegram'
  }

  return channel.platformId
}

export function formatEngageMode(mode: string | null): string {
  switch (mode) {
    case 'pattern':
      return 'Sempre (padrão)'
    case 'mention':
      return 'Menção'
    case 'mention-sticky':
      return 'Menção (sticky)'
    default:
      return mode || '—'
  }
}

export function formatSenderPolicy(policy: string): string {
  switch (policy) {
    case 'strict':
      return 'Restrito'
    case 'request_approval':
      return 'Aprovação'
    case 'public':
      return 'Público'
    default:
      return policy
  }
}
