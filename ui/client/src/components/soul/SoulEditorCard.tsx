import React from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, FileText } from 'lucide-react'
import { type MarkdownDoc } from '@/api/client'
import { parseMarkdown } from '@/lib/markdown'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '../../lib/formatters'


interface SoulEditorCardProps {
  doc: MarkdownDoc | null
  content: string
  source: MarkdownDoc['source']
  onContentChange: (value: string) => void
  isLoading: boolean
}

function formatCompactCount(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return formatNumber(value)
}

export const SoulEditorCard: React.FC<SoulEditorCardProps> = ({
  doc,
  content,
  source,
  onContentChange,
  isLoading,
}) => {
  const { t } = useTranslation('soul')

  const charCount = content.length
  const lineCount = content ? content.split('\n').length : 0
  const tokenCount = charCount > 0 ? Math.max(1, Math.round(charCount / 3.5)) : 0
  const renderedPreview = parseMarkdown(content)

  return (
    <Card className="flex min-h-0 flex-1 flex-col border-(--border-main) bg-(--bg-card) shadow-xs">
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <div className="flex flex-col gap-3 border-b border-(--border-main) px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-(--border-main) bg-(--bg-card-subtle) text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-mono text-xs font-semibold text-(--text-main)">
                {doc?.relativePath || t('noDocSelected')}
              </p>
              <p className="truncate text-[11px] text-(--text-dim)">
                {doc?.title || t('cardSubtitle')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span className="font-mono text-[10px] text-(--text-dim)">
              {t('charCount', { count: formatCompactCount(charCount) })}
              <span className="mx-1.5 text-(--border-main)">•</span>
              {t('tokenCount', { count: formatCompactCount(tokenCount) })}
              <span className="mx-1.5 text-(--border-main)">•</span>
              {t('lineCount', { count: formatCompactCount(lineCount) })}
            </span>
            <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wide">
              {t('markdownBadge')}
            </Badge>
            {source === 'default' && (
              <Badge variant="outline" className="text-[10px] font-semibold">
                {t('sourceDefault')}
              </Badge>
            )}
            {source === 'custom' && (
              <Badge variant="outline" className="border-(--accent-border) text-[10px] font-semibold text-primary">
                {t('sourceCustom')}
              </Badge>
            )}
          </div>
        </div>

        {source === 'default' && !isLoading && (
          <div className="border-b border-(--border-main) bg-(--bg-card-subtle) px-4 py-2.5 text-[11px] text-(--text-muted) sm:px-5">
            {t('defaultDocHint')}
          </div>
        )}

        <div className="grid min-h-[min(70dvh,42rem)] flex-1 grid-cols-1 divide-y divide-(--border-main) lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div className="flex min-h-70 flex-col">
            <div className="border-b border-(--border-main) bg-(--bg-card-subtle) px-4 py-2.5 sm:px-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-(--text-muted)">
                {t('editorTab')}
              </p>
            </div>

            {isLoading ? (
              <div className="flex flex-1 flex-col gap-2 p-5">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-[92%] rounded" />
                <Skeleton className="h-4 w-[88%] rounded" />
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="mt-2 h-4 w-[75%] rounded" />
              </div>
            ) : (
              <textarea
                className="min-h-60 flex-1 resize-none bg-transparent p-4 font-mono text-xs leading-relaxed text-(--text-main) outline-none placeholder:text-(--text-dim) sm:p-5"
                value={content}
                onChange={(e) => onContentChange(e.target.value)}
                placeholder={t('editorPlaceholder')}
                spellCheck={false}
              />
            )}
          </div>

          <div className="flex min-h-70 flex-col bg-(--bg-card-subtle)">
            <div className="flex items-center gap-2 border-b border-(--border-main) bg-(--bg-card-subtle) px-4 py-2.5 sm:px-5">
              <Eye className="h-3.5 w-3.5 text-(--text-dim)" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-(--text-muted)">
                {t('previewTab')}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-2/3 rounded" />
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-[90%] rounded" />
                  <Skeleton className="h-4 w-[85%] rounded" />
                </div>
              ) : !content.trim() ? (
                <p className="text-xs italic text-(--text-dim)">{t('emptyDoc')}</p>
              ) : (
                <div
                  className="prose-rendered text-xs leading-relaxed sm:text-sm"
                  dangerouslySetInnerHTML={{ __html: renderedPreview }}
                />
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
