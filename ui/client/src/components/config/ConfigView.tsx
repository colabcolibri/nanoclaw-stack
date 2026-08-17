import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sliders, Save, CheckCircle2, AlertCircle, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { ApiClient } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface ProviderMeta {
  name: string
  defaultBaseUrl: string
  defaultModel: string
  models: Array<{ id: string; label: string; recommended?: boolean }>
}

const PROVIDERS_META: Record<string, ProviderMeta> = {
  deepseek: {
    name: 'DeepSeek (Conector Nativo Direto)',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-v4-flash',
    models: [
      { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash (Padrão - Ultrarrápido & Econômico)', recommended: true },
      { id: 'deepseek-chat', label: 'DeepSeek V3 Chat' },
      { id: 'deepseek-reasoner', label: 'DeepSeek R1 (Raciocínio Avançado)' },
    ],
  },
  groq: {
    name: 'Groq (OpenAI GPT-OSS / Ultra-Rápido 500+ T/s)',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'openai/gpt-oss-120b',
    models: [
      { id: 'openai/gpt-oss-120b', label: 'OpenAI GPT-OSS 120B (Recomendado - 500 T/s)', recommended: true },
      { id: 'openai/gpt-oss-20b', label: 'OpenAI GPT-OSS 20B (Mais Leve - 1.000 T/s)' },
      { id: 'llama-3.3-70b-versatile', label: 'Meta Llama 3.3 70B Versatile' },
      { id: 'llama-3.1-8b-instant', label: 'Meta Llama 3.1 8B Instant' },
      { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill Llama 70B' },
      { id: 'mixtral-8x7b-32768', label: 'Mistral Mixtral 8x7B' },
    ],
  },
  claude: {
    name: 'Anthropic Claude Direct',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: [
      { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Recomendado)', recommended: true },
      { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
      { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    ],
  },
  openrouter: {
    name: 'OpenRouter AI (Multi-Provedor)',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'deepseek/deepseek-chat',
    models: [
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3 (OpenRouter)' },
      { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1 (OpenRouter)' },
      { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet (OpenRouter)' },
      { id: 'openai/gpt-4o', label: 'GPT-4o (OpenRouter)' },
      { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (Free)' },
    ],
  },
  opencode: {
    name: 'OpenCode Gateway (Local)',
    defaultBaseUrl: 'http://127.0.0.1:4096',
    defaultModel: 'deepseek-v4-flash',
    models: [
      { id: 'deepseek-v4-flash', label: 'deepseek-v4-flash' },
      { id: 'claude-3-5-sonnet-20241022', label: 'claude-3-5-sonnet-20241022' },
    ],
  },
}

export const ConfigView: React.FC = () => {
  const { t } = useTranslation('config')
  const [config, setConfig] = useState({
    name: '',
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    baseUrl: 'https://api.deepseek.com',
  })
  const [maskedKey, setMaskedKey] = useState<string>('••••••••••••')
  const [newApiKey, setNewApiKey] = useState<string>('')
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [showAdvancedUrl, setShowAdvancedUrl] = useState<boolean>(false)
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const data = await ApiClient.getConfig('barao')
      if (data.config) {
        const providerKey = data.config.provider || 'deepseek'
        const meta = PROVIDERS_META[providerKey] || PROVIDERS_META.deepseek

        setConfig({
          name: data.config.name || 'Barão',
          provider: providerKey,
          model: data.config.model || meta.defaultModel,
          baseUrl: data.config.baseUrl || meta.defaultBaseUrl,
        })
        if (data.config.maskedKey) {
          setMaskedKey(data.config.maskedKey)
        }
      }
    } catch {}
  }

  const handleProviderChange = (newProvider: string) => {
    const meta = PROVIDERS_META[newProvider] || PROVIDERS_META.deepseek
    setConfig((prev) => ({
      ...prev,
      provider: newProvider,
      model: meta.defaultModel,
      baseUrl: meta.defaultBaseUrl,
    }))
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

  const activeMeta = PROVIDERS_META[config.provider] || PROVIDERS_META.deepseek
  const availableModels = activeMeta.models

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
            {/* Assistant Name */}
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

            {/* Provider Selector */}
            <div>
              <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5">
                {t('provider')}
              </label>
              <select
                className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 cursor-pointer font-mono"
                value={config.provider}
                onChange={(e) => handleProviderChange(e.target.value)}
              >
                {Object.entries(PROVIDERS_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Model Selector (Synchronized Dynamically with Selected Provider) */}
            <div>
              <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5">
                {t('model')}
              </label>
              <select
                className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 cursor-pointer font-mono"
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* API Key Input */}
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

            {/* Advanced Base URL Toggle (Automated by default) */}
            <div className="pt-2 border-t border-[var(--border-main)]">
              <button
                type="button"
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1.5 cursor-pointer font-medium"
                onClick={() => setShowAdvancedUrl(!showAdvancedUrl)}
              >
                {showAdvancedUrl ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>Endpoint de API ({config.baseUrl})</span>
              </button>

              {showAdvancedUrl && (
                <div className="mt-3 animate-in fade-in">
                  <label className="block text-[11px] font-bold text-[var(--text-dim)] mb-1">
                    Custom Base URL (Preenchido automaticamente)
                  </label>
                  <input
                    type="text"
                    className="w-full px-3.5 py-2 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    value={config.baseUrl}
                    onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                    placeholder={activeMeta.defaultBaseUrl}
                  />
                </div>
              )}
            </div>

            <Button type="submit" disabled={isSaving} className="mt-2 gap-2 h-10 px-6 font-bold shadow-xs cursor-pointer">
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Salvando...' : t('save')}</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
