import React from 'react'
import { Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SoulSaveBannerProps {
  message: { text: string; type: 'success' | 'error' } | null
}

export const SoulSaveBanner: React.FC<SoulSaveBannerProps> = ({ message }) => {
  if (!message) return null

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border p-3 text-xs font-semibold animate-in fade-in',
        message.type === 'success'
          ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-500'
          : 'border-red-500/30 bg-red-500/15 text-red-500'
      )}
      role="status"
    >
      {message.type === 'success' ? (
        <Check className="h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0" />
      )}
      <span>{message.text}</span>
    </div>
  )
}
