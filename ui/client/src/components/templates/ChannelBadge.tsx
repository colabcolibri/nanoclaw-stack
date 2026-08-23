import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const channelBadgeVariants = cva('border', {
  variants: {
    channel: {
      macos:
        'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
      telegram:
        'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
      cli: 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300',
      web: 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300',
    },
  },
})

type ChannelKind = NonNullable<VariantProps<typeof channelBadgeVariants>['channel']>

const CHANNEL_KINDS = new Set<ChannelKind>(['macos', 'telegram', 'cli', 'web'])

export function resolveChannelKind(channelType: string): ChannelKind {
  const normalized = channelType.toLowerCase() as ChannelKind
  return CHANNEL_KINDS.has(normalized) ? normalized : 'web'
}

type ChannelBadgeProps = Omit<React.ComponentProps<typeof Badge>, 'variant'> &
  VariantProps<typeof channelBadgeVariants> & {
    channel: ChannelKind
  }

export const ChannelBadge: React.FC<ChannelBadgeProps> = ({
  channel,
  className,
  ...props
}) => (
  <Badge
    variant="outline"
    className={cn(channelBadgeVariants({ channel }), className)}
    {...props}
  />
)
