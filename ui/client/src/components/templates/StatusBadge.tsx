import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const statusBadgeVariants = cva('border', {
  variants: {
    variant: {
      success:
        'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      warning:
        'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300',
    },
  },
  defaultVariants: {
    variant: 'success',
  },
})

type StatusBadgeProps = Omit<React.ComponentProps<typeof Badge>, 'variant'> &
  VariantProps<typeof statusBadgeVariants>

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  variant = 'success',
  className,
  ...props
}) => (
  <Badge
    variant="outline"
    className={cn(statusBadgeVariants({ variant }), className)}
    {...props}
  />
)
