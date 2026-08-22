import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-[var(--bg-card-subtle)]', className)}
      {...props}
    />
  )
}

export { Skeleton }
