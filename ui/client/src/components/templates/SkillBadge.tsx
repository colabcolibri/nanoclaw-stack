import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const skillBadgeVariants = cva('border', {
  variants: {
    kind: {
      ref: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
      script:
        'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300',
      tokens:
        'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300',
      chars:
        'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    },
  },
})

type SkillBadgeProps = Omit<React.ComponentProps<typeof Badge>, 'variant'> &
  VariantProps<typeof skillBadgeVariants> & {
    kind: NonNullable<VariantProps<typeof skillBadgeVariants>['kind']>
  }

export const SkillBadge: React.FC<SkillBadgeProps> = ({ kind, className, ...props }) => (
  <Badge
    variant="outline"
    className={cn(skillBadgeVariants({ kind }), className)}
    {...props}
  />
)
