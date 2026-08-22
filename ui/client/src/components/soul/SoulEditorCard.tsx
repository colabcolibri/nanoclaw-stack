import React from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, FileText } from 'lucide-react'
import { type MarkdownDoc } from '@/api/client'
import { parseMarkdown } from '@/lib/markdown'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface SoulEditorCardProps {
  doc: MarkdownDoc | null
  content: string
  onContentChange: (value: string) => void
  isLoading: boolean
}

function formatCompactCount(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return value.toLocaleString()
}

export const SoulEditorCard: React.FC<SoulEditorCardProps> = ({
  doc,
  content,
  onContentChange,
  isLoading,
}) => {
  const { t } = useTranslation('soul')

  const charCount = content.length
  const lineCount = content ? content.split('\n').length : 0
  const tokenCount = charCount > 0 ? Math.max(1, Math.round(charCount / 3.5)) : 0
  const renderedPreview = parseMarkdown(content)

  return (
    <Card className="flex min-h-0 flex-1 flex-col border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs">
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <div className="flex flex-col gap-3 border-b border-[var(--border-main)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-main)] bg-[var(--bg-card-subtle)] text-[var(--accent)]">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-mono text-xs font-semibold text-[var(--text-main)]">
                {doc?.relativePath || t('noDocSelected')}
              </p>
              <p className="truncate text-[11px] text-[var(--text-dim)]">
                {doc?.title || t('cardSubtitle')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span className="font-mono text-[10px] text-[var(--text-dim)]">
              {t('charCount', { count: formatCompactCount(charCount) })}
              <span className="mx-1.5 text-[var(--border-main)]">•</span>
              {t('tokenCount', { count: formatCompactCount(tokenCount) })}
              <span className="mx-1.5 text-[var(--border-main)]">•</span>
              {t('lineCount', { count: formatCompactCount(lineCount) })}
            </span>
            <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wide">
              {t('markdownBadge')}
            </Badge>
          </div>
        </div>

        <div className="grid min-h-[min(70dvh,42rem)] flex-1 grid-cols-1 divide-y divide-[var(--border-main)] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div className="flex min-h-[280px] flex-col">
            <div className="border-b border-[var(--border-main)] bg-[var(--bg-card-subtle)] px-4 py-2.5 sm:px-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
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
                className="min-h-[240px] flex-1 resize-none bg-transparent p-4 font-mono text-xs leading-relaxed text-[var(--text-main)] outline-none placeholder:text-[var(--text-dim)] sm:p-5"
                value={content}
                onChange={(e) => onContentChange(e.target.value)}
                placeholder={t('editorPlaceholder')}
                spellCheck={false}
              />
            )}
          </div>

          <div className="flex min-h-[280px] flex-col bg-[var(--bg-card-subtle)]">
            <div className="flex items-center gap-2 border-b border-[var(--border-main)] bg-[var(--bg-card-subtle)] px-4 py-2.5 sm:px-5">
              <Eye className="h-3.5 w-3.5 text-[var(--text-dim)]" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
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
                <p className="text-xs italic text-[var(--text-dim)]">{t('emptyDoc')}</p>
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
