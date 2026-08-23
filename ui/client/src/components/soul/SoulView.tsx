import React, { useState, useEffect } from 'react'
import { useDefaultGroup } from '@/contexts/AppConfigContext'
import { useTranslation } from 'react-i18next'
import { Save } from 'lucide-react'
import { ApiClient, type MarkdownDoc } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { SoulSaveBanner } from '@/components/soul/SoulSaveBanner'
import { SoulDocSelect } from '@/components/soul/SoulDocSelect'
import { SoulEditorCard } from '@/components/soul/SoulEditorCard'
import { Button } from '@/components/ui/button'

export const SoulView: React.FC = () => {
  const group = useDefaultGroup()
  const { t } = useTranslation('soul')
  const [docs, setDocs] = useState<MarkdownDoc[]>([])
  const [selectedPath, setSelectedPath] = useState<string>('instructions.prepend.md')
  const [content, setContent] = useState<string>('')
  const [docSource, setDocSource] = useState<MarkdownDoc['source']>('custom')
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
      const data = await ApiClient.getDocs(group)
      setDocs(data.docs || [])
      if (data.docs && data.docs.length > 0 && !selectedPath) {
        setSelectedPath(data.docs[0].relativePath)
      }
    } catch {
      /* ignore */
    }
  }

  const loadDocContent = async (path: string) => {
    setIsLoading(true)
    try {
      const data = await ApiClient.getDoc(group, path)
      setContent(data.content || '')
      setDocSource(data.source || 'empty')
    } catch {
      setContent('')
      setDocSource('empty')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!content.trim()) {
      setToastMessage({ text: t('saveEmptyBlocked'), type: 'error' })
      setTimeout(() => setToastMessage(null), 3000)
      return
    }
    setIsSaving(true)
    try {
      await ApiClient.saveDoc(group, selectedPath, content)
      setDocSource('custom')
      await loadDocsList()
      setToastMessage({ text: t('savedSuccess'), type: 'success' })
      setTimeout(() => setToastMessage(null), 3000)
    } catch {
      setToastMessage({ text: t('saveError'), type: 'error' })
      setTimeout(() => setToastMessage(null), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const selectedDoc = docs.find((d) => d.relativePath === selectedPath) ?? null

  return (
    <div className="flex w-full min-h-0 flex-1 flex-col gap-5">
      <SoulSaveBanner message={toastMessage} />

      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <SoulDocSelect
            docs={docs}
            value={selectedPath}
            onValueChange={setSelectedPath}
            disabled={isLoading}
          />
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="h-9 w-full shrink-0 gap-1.5 px-4 text-xs font-semibold sm:w-auto"
        >
          <Save className="h-3.5 w-3.5" />
          <span>{isSaving ? t('saving') : t('savePrompt')}</span>
        </Button>
      </div>

      <SoulEditorCard
        doc={selectedDoc}
        content={content}
        source={docSource}
        onContentChange={setContent}
        isLoading={isLoading}
      />
    </div>
  )
}
