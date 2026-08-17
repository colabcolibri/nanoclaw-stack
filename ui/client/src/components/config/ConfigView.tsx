import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sliders, Save, Check, AlertCircle, KeyRound, CheckCircle2 } from 'lucide-react'
import { ApiClient } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export const ConfigView: React.FC = () => {
  const { t } = useTranslation('config')
  const [config, setConfig] = useState<any>({
    name: 'Barão',
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    baseUrl: 'https://api.deepseek.com',
  })
  const [newApiKey, setNewApiKey] = useState<string>('')
  const [maskedKey, setMaskedKey] = useState<string>('sk-...')
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const data = await ApiClient.getConfig('barao')
      if (data.config) {
        setConfig({
          name: data.config.name || 'Barão',
          provider: data.config.provider || 'deepseek',
          model: data.config.model || 'deepseek-v4-flash',
          baseUrl: data.config.baseUrl || 'https://api.deepseek.com',
        })
        if (data.config.maskedKey) {
          setMaskedKey(data.config.maskedKey)
        }
      }
    } catch {}
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const payload: any = { ...config }
      if (newApiKey.trim()) {
        payload.apiKey = newApiKey.trim()
      }
      await ApiClient.saveConfig('barao', payload)
      setToast({ text: t('savedSuccess'), type: 'success' })
      setNewApiKey('')
      setTimeout(() => setToast(null), 3000)
    } catch {
      setToast({ text: t('saveError'), type: 'error' })
      setTimeout(() => setToast(null), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full flex-1 max-w-2xl">
      {toast && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 animate-in fade-in ${
            toast.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-300'
          }`}
        >
          {toast.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      <PageHeader
        icon={<Sliders className="w-5 h-5" />}
        title={t('title')}
        subtitle={t('subtitle')}
      />

      <Card className="border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs overflow-hidden">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5">
                {t('assistantName')}
              </label>
              <input
                type="text"
                className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                placeholder="Barão"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5">
                {t('provider')}
              </label>
              <select
                className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 cursor-pointer font-mono"
                value={config.provider}
                onChange={(e) => setConfig({ ...config, provider: e.target.value })}
              >
                <option value="deepseek">DeepSeek (Conector Nativo Direto)</option>
                <option value="groq">Groq (Llama 3.3 70B / DeepSeek R1 - Ultra Rápido)</option>
                <option value="opencode">OpenCode Gateway</option>
                <option value="claude">Anthropic Claude Direct</option>
                <option value="openrouter">OpenRouter AI</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5">
                {t('model')}
              </label>
              <select
                className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 cursor-pointer font-mono"
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
              >
                <option value="deepseek-v4-flash">deepseek-v4-flash (Nativo DeepSeek)</option>
                <option value="deepseek-chat">deepseek-chat (DeepSeek V3 Chat)</option>
                <option value="deepseek-reasoner">deepseek-reasoner (DeepSeek R1)</option>
                <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet-20241022</option>
                <option value="gpt-4o">gpt-4o</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5">
                {t('baseUrl')}
              </label>
              <input
                type="text"
                className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                value={config.baseUrl}
                onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                placeholder="https://api.deepseek.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5">
                {t('apiKeyStatus')}
              </label>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="success">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{t('keyConfigured')}</span>
                </Badge>
                <code className="text-xs font-mono text-[var(--accent)] bg-[var(--accent-subtle)] px-2 py-0.5 rounded border border-[var(--accent-border)] font-bold">
                  {maskedKey}
                </code>
              </div>
              <input
                type="password"
                className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder={t('keyPlaceholder')}
                autoComplete="off"
              />
            </div>

            <Button type="submit" disabled={isSaving} className="mt-2 gap-2 h-10 px-6 font-bold shadow-xs">
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Salvando...' : t('save')}</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
