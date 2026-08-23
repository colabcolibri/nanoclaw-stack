import { cn } from '@/lib/utils'
import * as React from 'react'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-lg border border-(--border-main) bg-(--bg-input) px-3 py-1 text-sm text-(--text-main) shadow-xs transition-colors',
          'placeholder:text-(--text-dim)',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)/30 focus-visible:border-(--accent)',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
