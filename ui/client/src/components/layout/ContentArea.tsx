import React from 'react'
import { cn } from '@/lib/utils'

type ContentWidth = 'narrow' | 'default' | 'wide' | 'full'

interface ContentAreaProps {
  children: React.ReactNode
  width?: ContentWidth
  className?: string
}

const widthClasses: Record<ContentWidth, string> = {
  narrow: 'max-w-3xl',
  default: 'max-w-5xl',
  wide: 'max-w-[var(--content-max)]',
  full: 'max-w-[var(--content-max)]',
}

export const ContentArea: React.FC<ContentAreaProps> = ({
  children,
  width = 'wide',
  className,
}) => {
  return (
    <div
      className={cn(
        'w-full mx-auto flex flex-col flex-1 min-h-0',
        widthClasses[width],
        className
      )}
    >
      {children}
    </div>
  )
}

export function getViewContentWidth(view: string): ContentWidth {
  switch (view) {
    case 'chat':
    case 'agents':
    case 'models':
    case 'usage':
    case 'logs':
      return 'full'
    case 'config':
    case 'soul':
      return 'narrow'
    default:
      return 'default'
  }
}
