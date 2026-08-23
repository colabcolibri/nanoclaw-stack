import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Search } from 'lucide-react'
import { filterTimezones, formatTimezoneLabel, getSupportedTimezones } from '@/lib/timezones'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface TimezoneSelectProps {
  value: string
  onChange: (timezone: string) => void
  disabled?: boolean
  className?: string
}

export const TimezoneSelect: React.FC<TimezoneSelectProps> = ({
  value,
  onChange,
  disabled,
  className,
}) => {
  const { t, i18n } = useTranslation('config')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const timezones = useMemo(() => getSupportedTimezones(), [])

  const filtered = useMemo(() => filterTimezones(query, timezones), [query, timezones])
  const locale = i18n.language === 'en' ? 'en-US' : 'pt-BR'

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="h-auto min-h-10 w-full justify-between gap-2 px-3.5 py-2.5 text-left font-mono text-xs font-normal"
      >
        <span className="min-w-0 truncate">
          {value ? formatTimezoneLabel(value, locale) : t('timezonePlaceholder')}
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </Button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-(--border-main) bg-(--bg-card) shadow-lg">
          <div className="border-b border-(--border-main) p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--text-dim)" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('timezoneSearch')}
                className="h-8 pl-8 text-xs"
                autoFocus
              />
            </div>
          </div>
          <ul className="max-h-56 overflow-y-auto overflow-x-hidden p-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-(--text-muted)">{t('timezoneEmpty')}</li>
            ) : (
              filtered.map((tz) => {
                const selected = tz === value
                return (
                  <li key={tz}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(tz)
                        setOpen(false)
                        setQuery('')
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors',
                        selected
                          ? 'bg-(--accent-subtle) text-primary'
                          : 'text-(--text-main) hover:bg-(--bg-card-subtle)'
                      )}
                    >
                      <span className="min-w-0 truncate font-mono">
                        {formatTimezoneLabel(tz, locale)}
                      </span>
                      {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
