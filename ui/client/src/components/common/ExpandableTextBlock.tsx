import React, { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ExpandableTextBlockProps {
  content: string
  collapsedMaxHeight?: number
  expandWhenLongerThan?: number
  className?: string
  preClassName?: string
  mono?: boolean
}

export const ExpandableTextBlock: React.FC<ExpandableTextBlockProps> = ({
  content,
  collapsedMaxHeight = 128,
  expandWhenLongerThan = 180,
  className,
  preClassName,
  mono = true,
}) => {
  const { t } = useTranslation('common')
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const contentId = useId()

  useEffect(() => {
    setExpanded(false)
  }, [content])

  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    const measure = () => {
      setOverflows(el.scrollHeight > collapsedMaxHeight + 4)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [content, collapsedMaxHeight])

  if (!content.trim()) return null

  const isLong = content.length > expandWhenLongerThan
  const showToggle = overflows || isLong
  const isCollapsed = showToggle && !expanded

  return (
    <div className={cn('space-y-2', className)}>
      <div
        id={contentId}
        ref={contentRef}
        className={cn(
          'rounded-lg border border-(--border-main) bg-(--bg-card) p-2.5 text-[11px] leading-relaxed text-(--text-main) wrap-break-word whitespace-pre-wrap',
          mono && 'font-mono',
          isCollapsed && 'overflow-hidden',
          preClassName
        )}
        style={isCollapsed ? { maxHeight: collapsedMaxHeight } : undefined}
      >
        {content}
      </div>

      {showToggle && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-[10px] font-semibold text-(--accent)"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          aria-controls={contentId}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              {t('seeLess')}
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              {t('seeMore')}
            </>
          )}
        </Button>
      )}
    </div>
  )
}
