import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, Check, AlertCircle } from 'lucide-react'
import { ApiClient, type MarkdownDoc } from '@/api/client'
import { parseMarkdown } from '@/lib/markdown'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const SoulView: React.FC = () => {
  const { t } = useTranslation('soul')
  const [docs, setDocs] = useState<MarkdownDoc[]>([])
  const [selectedPath, setSelectedPath] = useState<string>('instructions.prepend.md')
  const [content, setContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadDocsList()
  }, [])

  useEffect(() => {
    if (selectedPath) {
      loadDocContent(selectedPath)
    }
  }, [selectedPath])

  const loadDocsList = async () => {
    try {
      const data = await ApiClient.getDocs('barao')
      setDocs(data.docs || [])
      if (data.docs && data.docs.length > 0 && !selectedPath) {
        setSelectedPath(data.docs[0].relativePath)
      }
    } catch {}
  }

  const loadDocContent = async (path: string) => {
    setIsLoading(true)
    try {
      const data = await ApiClient.getDoc('barao', path)
      setContent(data.content || '')
    } catch {
      setContent('')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await ApiClient.saveDoc('barao', selectedPath, content)
      setToastMessage({ text: t('savedSuccess'), type: 'success' })
      setTimeout(() => setToastMessage(null), 3000)
    } catch {
      setToastMessage({ text: t('saveError'), type: 'error' })
      setTimeout(() => setToastMessage(null), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const charCount = content.length
  const lineCount = content ? content.split('\n').length : 0
  const tokenCount = charCount > 0 ? Math.max(1, Math.round(charCount / 3.5)) : 0
  const renderedPreview = parseMarkdown(content)

  return (
    <div className="flex w-full min-h-0 flex-1 flex-col gap-4">
      {toastMessage && (
        <div
          className={`flex items-center gap-2 rounded-lg border p-3 text-xs font-semibold animate-in fade-in ${
            toastMessage.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-500'
              : 'border-red-500/30 bg-red-500/15 text-red-500'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <Check className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            <Select value={selectedPath} onValueChange={setSelectedPath}>
              <SelectTrigger className="h-9 w-[min(100%,16rem)] font-mono text-xs sm:w-72">
                <SelectValue placeholder={t('selectDoc')} />
              </SelectTrigger>
              <SelectContent>
                {docs.map((doc) => (
                  <SelectItem key={doc.relativePath} value={doc.relativePath} className="font-mono text-xs">
                    {doc.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="h-9 gap-1.5 px-4 text-xs font-semibold"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? t('saving') : t('savePrompt')}</span>
            </Button>
          </>
        }
      />

      <Card className="flex min-h-0 flex-1 flex-col border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs">
        <CardContent className="grid min-h-[calc(100dvh-15rem)] flex-1 grid-cols-1 divide-y divide-[var(--border-main)] p-0 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div className="flex min-h-[320px] flex-col bg-[var(--bg-card)]">
            <div className="flex items-center justify-between border-b border-[var(--border-main)] bg-[var(--bg-card-subtle)] p-3 px-4 text-xs font-semibold text-[var(--text-muted)] font-mono">
              <span>{t('editorTab')}</span>
              <div className="flex items-center gap-3 text-[11px] text-[var(--text-dim)]">
                <span>{t('charCount', { count: charCount.toLocaleString() })}</span>
                <span>•</span>
                <span>{t('tokenCount', { count: tokenCount.toLocaleString() })}</span>
                <span>•</span>
                <span>{t('lineCount', { count: lineCount.toLocaleString() })}</span>
              </div>
            </div>

            <textarea
              className="min-h-[280px] flex-1 resize-none bg-transparent p-5 font-mono text-xs leading-relaxed text-[var(--text-main)] outline-none placeholder:text-[var(--text-dim)]"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Digite as diretrizes e regras em Markdown..."
              disabled={isLoading}
            />
          </div>

          <div className="flex min-h-[320px] flex-col bg-[var(--bg-card-subtle)]">
            <div className="border-b border-[var(--border-main)] bg-[var(--bg-card-subtle)] p-3 px-4 text-xs font-semibold text-[var(--text-muted)] font-mono">
              <span>{t('previewTab')}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {!content.trim() ? (
                <p className="text-xs italic text-[var(--text-dim)]">{t('emptyDoc')}</p>
              ) : (
                <div
                  className="prose-rendered text-xs leading-relaxed sm:text-sm"
                  dangerouslySetInnerHTML={{ __html: renderedPreview }}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
