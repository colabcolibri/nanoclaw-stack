import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, FileText, Check, AlertCircle } from 'lucide-react'
import { ApiClient, type MarkdownDoc } from '@/api/client'
import { parseMarkdown } from '@/lib/markdown'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

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
    <div className="flex flex-col gap-4">
      {/* Toast Banner */}
      {toastMessage && (
        <div
          className={`p-3 rounded-lg border text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
            toastMessage.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500'
              : 'bg-red-500/15 border-red-500/30 text-red-500'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <Check className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header Card */}
      <Card className="border-[var(--border-main)] bg-[var(--bg-card)] shadow-xl">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 bg-[var(--bg-card-subtle)] border-b border-[var(--border-main)]">
          <div>
            <CardTitle className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--accent)]" />
              <span>{t('title')}</span>
            </CardTitle>
            <CardDescription className="text-xs text-[var(--text-muted)] mt-1">
              {t('subtitle')}
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <select
              className="bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-input)] text-xs rounded-lg px-3 py-2 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 cursor-pointer font-mono font-medium"
              value={selectedPath}
              onChange={(e) => setSelectedPath(e.target.value)}
            >
              {docs.map((d) => (
                <option key={d.relativePath} value={d.relativePath}>
                  {d.title}
                </option>
              ))}
            </select>

            <Button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="gap-1.5 text-xs h-9 px-4 font-semibold"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? t('saving') : t('savePrompt')}</span>
            </Button>
          </div>
        </CardHeader>

        {/* Editor & Preview Split Grid */}
        <CardContent className="p-0 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[var(--border-main)] min-h-[560px]">
          {/* Left Column: Markdown Editor */}
          <div className="flex flex-col bg-[var(--bg-card)]">
            <div className="p-3 px-4 border-b border-[var(--border-main)] bg-[var(--bg-card-subtle)] flex items-center justify-between text-xs text-[var(--text-muted)] font-mono font-semibold">
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
              className="flex-1 p-5 bg-transparent text-[var(--text-main)] font-mono text-xs leading-relaxed outline-none resize-none min-h-[500px] placeholder:text-[var(--text-dim)]"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Digite as diretrizes e regras em Markdown..."
            />
          </div>

          {/* Right Column: Live Markdown Preview */}
          <div className="flex flex-col bg-[var(--bg-card-subtle)]">
            <div className="p-3 px-4 border-b border-[var(--border-main)] bg-[var(--bg-card-subtle)] flex items-center justify-between text-xs text-[var(--text-muted)] font-mono font-semibold">
              <span>{t('previewTab')}</span>
            </div>

            <div className="p-6 flex-1 overflow-y-auto max-h-[560px]">
              {!content.trim() ? (
                <p className="text-xs text-[var(--text-dim)] italic">{t('emptyDoc')}</p>
              ) : (
                <div
                  className="prose-rendered text-xs sm:text-sm leading-relaxed"
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
