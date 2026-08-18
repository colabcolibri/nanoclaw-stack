import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sliders, Save, CheckCircle2, AlertCircle, Check, ChevronDown, ChevronUp, Zap, ArrowDownToLine, ArrowUpFromLine, Layers, Database, Target, Coins, Cpu } from 'lucide-react'
import { ApiClient } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export interface ModelPricing {
  inputPerMillion: number       // Token In (Prompt / Cache Miss) $/1M
  outputPerMillion: number      // Token Out (Completion) $/1M
  cacheWritePerMillion: number  // Cache In / Cache Write $/1M
  cacheHitPerMillion: number    // Cache Out / Cache Read (Hit) $/1M
  contextWindow: string         // e.g. "64k", "128k", "200k"
  savingsPct?: number           // e.g. 97% savings on cache hit
}

export interface ModelItem {
  id: string
  label: string
  recommended?: boolean
  pricing: ModelPricing
}

export interface ProviderMeta {
  name: string
  defaultBaseUrl: string
  defaultModel: string
  models: ModelItem[]
}

const PROVIDERS_META: Record<string, ProviderMeta> = {
  deepseek: {
    name: 'DeepSeek (Conector Nativo Direto)',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-v4-flash',
    models: [
      {
        id: 'deepseek-v4-flash',
        label: 'DeepSeek V4 Flash (Padrão - Ultrarrápido & Econômico)',
        recommended: true,
        pricing: {
          inputPerMillion: 0.44,
          outputPerMillion: 1.32,
          cacheWritePerMillion: 0.44,
          cacheHitPerMillion: 0.014,
          contextWindow: '64k',
          savingsPct: 97,
        },
      },
      {
        id: 'deepseek-chat',
        label: 'DeepSeek V3 Chat',
        pricing: {
          inputPerMillion: 0.44,
          outputPerMillion: 1.32,
          cacheWritePerMillion: 0.44,
          cacheHitPerMillion: 0.014,
          contextWindow: '64k',
          savingsPct: 97,
        },
      },
      {
        id: 'deepseek-reasoner',
        label: 'DeepSeek R1 (Raciocínio Avançado)',
        pricing: {
          inputPerMillion: 1.32,
          outputPerMillion: 3.96,
          cacheWritePerMillion: 1.32,
          cacheHitPerMillion: 0.044,
          contextWindow: '64k',
          savingsPct: 97,
        },
      },
    ],
  },
  groq: {
    name: 'Groq (OpenAI GPT-OSS / Ultra-Rápido 500+ T/s)',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'openai/gpt-oss-120b',
    models: [
      {
        id: 'openai/gpt-oss-120b',
        label: 'OpenAI GPT-OSS 120B (Recomendado - 500 T/s)',
        recommended: true,
        pricing: {
          inputPerMillion: 0.15,
          outputPerMillion: 0.60,
          cacheWritePerMillion: 0.15,
          cacheHitPerMillion: 0.15,
          contextWindow: '128k',
          savingsPct: 0,
        },
      },
      {
        id: 'openai/gpt-oss-20b',
        label: 'OpenAI GPT-OSS 20B (Mais Leve - 1.000 T/s)',
        pricing: {
          inputPerMillion: 0.075,
          outputPerMillion: 0.30,
          cacheWritePerMillion: 0.075,
          cacheHitPerMillion: 0.075,
          contextWindow: '128k',
          savingsPct: 0,
        },
      },
      {
        id: 'llama-3.3-70b-versatile',
        label: 'Meta Llama 3.3 70B Versatile',
        pricing: {
          inputPerMillion: 0.59,
          outputPerMillion: 0.79,
          cacheWritePerMillion: 0.59,
          cacheHitPerMillion: 0.59,
          contextWindow: '128k',
          savingsPct: 0,
        },
      },
      {
        id: 'llama-3.1-8b-instant',
        label: 'Meta Llama 3.1 8B Instant',
        pricing: {
          inputPerMillion: 0.05,
          outputPerMillion: 0.08,
          cacheWritePerMillion: 0.05,
          cacheHitPerMillion: 0.05,
          contextWindow: '128k',
          savingsPct: 0,
        },
      },
      {
        id: 'deepseek-r1-distill-llama-70b',
        label: 'DeepSeek R1 Distill Llama 70B',
        pricing: {
          inputPerMillion: 0.59,
          outputPerMillion: 0.79,
          cacheWritePerMillion: 0.59,
          cacheHitPerMillion: 0.59,
          contextWindow: '128k',
          savingsPct: 0,
        },
      },
      {
        id: 'mixtral-8x7b-32768',
        label: 'Mistral Mixtral 8x7B',
        pricing: {
          inputPerMillion: 0.24,
          outputPerMillion: 0.24,
          cacheWritePerMillion: 0.24,
          cacheHitPerMillion: 0.24,
          contextWindow: '32k',
          savingsPct: 0,
        },
      },
    ],
  },
  claude: {
    name: 'Anthropic Claude Direct',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: [
      {
        id: 'claude-3-5-sonnet-20241022',
        label: 'Claude 3.5 Sonnet (Recomendado)',
        recommended: true,
        pricing: {
          inputPerMillion: 3.00,
          outputPerMillion: 15.00,
          cacheWritePerMillion: 3.75,
          cacheHitPerMillion: 0.30,
          contextWindow: '200k',
          savingsPct: 90,
        },
      },
      {
        id: 'claude-3-5-haiku-20241022',
        label: 'Claude 3.5 Haiku',
        pricing: {
          inputPerMillion: 0.80,
          outputPerMillion: 4.00,
          cacheWritePerMillion: 1.00,
          cacheHitPerMillion: 0.08,
          contextWindow: '200k',
          savingsPct: 90,
        },
      },
      {
        id: 'claude-3-opus-20240229',
        label: 'Claude 3 Opus',
        pricing: {
          inputPerMillion: 15.00,
          outputPerMillion: 75.00,
          cacheWritePerMillion: 18.75,
          cacheHitPerMillion: 1.50,
          contextWindow: '200k',
          savingsPct: 90,
        },
      },
    ],
  },
  openrouter: {
    name: 'OpenRouter AI (Multi-Provedor)',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'deepseek/deepseek-chat',
    models: [
      {
        id: 'deepseek/deepseek-chat',
        label: 'DeepSeek V3 (OpenRouter)',
        pricing: {
          inputPerMillion: 0.55,
          outputPerMillion: 1.65,
          cacheWritePerMillion: 0.55,
          cacheHitPerMillion: 0.02,
          contextWindow: '64k',
          savingsPct: 96,
        },
      },
      {
        id: 'deepseek/deepseek-r1',
        label: 'DeepSeek R1 (OpenRouter)',
        pricing: {
          inputPerMillion: 1.50,
          outputPerMillion: 4.50,
          cacheWritePerMillion: 1.50,
          cacheHitPerMillion: 0.05,
          contextWindow: '64k',
          savingsPct: 96,
        },
      },
      {
        id: 'anthropic/claude-3.5-sonnet',
        label: 'Claude 3.5 Sonnet (OpenRouter)',
        pricing: {
          inputPerMillion: 3.00,
          outputPerMillion: 15.00,
          cacheWritePerMillion: 3.75,
          cacheHitPerMillion: 0.30,
          contextWindow: '200k',
          savingsPct: 90,
        },
      },
      {
        id: 'openai/gpt-4o',
        label: 'GPT-4o (OpenRouter)',
        pricing: {
          inputPerMillion: 2.50,
          outputPerMillion: 10.00,
          cacheWritePerMillion: 2.50,
          cacheHitPerMillion: 1.25,
          contextWindow: '128k',
          savingsPct: 50,
        },
      },
      {
        id: 'google/gemini-2.0-flash-exp:free',
        label: 'Gemini 2.0 Flash (Free)',
        pricing: {
          inputPerMillion: 0.00,
          outputPerMillion: 0.00,
          cacheWritePerMillion: 0.00,
          cacheHitPerMillion: 0.00,
          contextWindow: '1000k',
          savingsPct: 0,
        },
      },
    ],
  },
  opencode: {
    name: 'OpenCode Gateway (Local)',
    defaultBaseUrl: 'http://127.0.0.1:4096',
    defaultModel: 'deepseek-v4-flash',
    models: [
      {
        id: 'deepseek-v4-flash',
        label: 'deepseek-v4-flash',
        pricing: {
          inputPerMillion: 0.44,
          outputPerMillion: 1.32,
          cacheWritePerMillion: 0.44,
          cacheHitPerMillion: 0.014,
          contextWindow: '64k',
          savingsPct: 97,
        },
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        label: 'claude-3-5-sonnet-20241022',
        pricing: {
          inputPerMillion: 3.00,
          outputPerMillion: 15.00,
          cacheWritePerMillion: 3.75,
          cacheHitPerMillion: 0.30,
          contextWindow: '200k',
          savingsPct: 90,
        },
      },
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
  const [keysStatus, setKeysStatus] = useState<Record<string, { hasKey: boolean; masked: string }>>({})
  const [newApiKey, setNewApiKey] = useState<string>('')
  const [usdToBrlRate, setUsdToBrlRate] = useState<number>(5.5)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [showAdvancedUrl, setShowAdvancedUrl] = useState<boolean>(false)
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadConfig()
    loadRate()
  }, [])

  const loadRate = async () => {
    try {
      const stats = await ApiClient.getStats()
      if (stats.usdToBrlRate && stats.usdToBrlRate > 0) {
        setUsdToBrlRate(stats.usdToBrlRate)
      }
    } catch {}
  }

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
        if (data.config.keysStatus) {
          setKeysStatus(data.config.keysStatus)
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
      await loadConfig()
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
  const activeKeyInfo = keysStatus[config.provider] || { hasKey: false, masked: '' }

  const selectedModelObj = availableModels.find((m) => m.id === config.model) || availableModels[0]
  const pricing = selectedModelObj?.pricing || {
    inputPerMillion: 0.44,
    outputPerMillion: 1.32,
    cacheWritePerMillion: 0.44,
    cacheHitPerMillion: 0.014,
    contextWindow: '64k',
    savingsPct: 97,
  }

  const inputBrl = pricing.inputPerMillion * usdToBrlRate
  const outputBrl = pricing.outputPerMillion * usdToBrlRate
  const cacheWriteBrl = pricing.cacheWritePerMillion * usdToBrlRate
  const cacheHitBrl = pricing.cacheHitPerMillion * usdToBrlRate

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
          <form onSubmit={handleSubmit} className="space-y-5">
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-[var(--text-main)]">
                  {t('model')}
                </label>
                <Badge variant="outline" className="text-[10px] py-0 px-2 gap-1 font-mono font-bold">
                  <Layers className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                  <span>Janela: {pricing.contextWindow} tok</span>
                </Badge>
              </div>
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

            {/* Live Token Pricing & Cache Parameters Panel */}
            <div className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card-subtle)] space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-[var(--text-main)]">
                    Parâmetros de Tokens & Custos ({selectedModelObj.label.split(' ')[0]})
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[var(--text-dim)]">
                  Câmbio ref: 1 USD = R$ {usdToBrlRate.toFixed(2)}
                </span>
              </div>

              {/* 4 Metrics Grid: Token In, Token Out, Cache In / Write, Cache Out / Read */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* 1. Token In */}
                <div className="p-3 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 mb-1">
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Token In</span>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-[var(--text-main)] font-mono">
                      ${pricing.inputPerMillion.toFixed(3)}
                    </div>
                    <div className="text-[10px] text-[var(--text-dim)] font-mono">
                      ~R$ {inputBrl.toFixed(2)} / 1M
                    </div>
                  </div>
                  <span className="text-[9px] text-[var(--text-dim)] mt-1.5 block border-t border-[var(--border-main)] pt-1">
                    Entrada s/ cache
                  </span>
                </div>

                {/* 2. Token Out */}
                <div className="p-3 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 mb-1">
                    <ArrowUpFromLine className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Token Out</span>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-[var(--text-main)] font-mono">
                      ${pricing.outputPerMillion.toFixed(3)}
                    </div>
                    <div className="text-[10px] text-[var(--text-dim)] font-mono">
                      ~R$ {outputBrl.toFixed(2)} / 1M
                    </div>
                  </div>
                  <span className="text-[9px] text-[var(--text-dim)] mt-1.5 block border-t border-[var(--border-main)] pt-1">
                    Geração resposta
                  </span>
                </div>

                {/* 3. Cache In / Write */}
                <div className="p-3 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 mb-1">
                    <Database className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Cache In</span>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-[var(--text-main)] font-mono">
                      ${pricing.cacheWritePerMillion.toFixed(3)}
                    </div>
                    <div className="text-[10px] text-[var(--text-dim)] font-mono">
                      ~R$ {cacheWriteBrl.toFixed(2)} / 1M
                    </div>
                  </div>
                  <span className="text-[9px] text-[var(--text-dim)] mt-1.5 block border-t border-[var(--border-main)] pt-1">
                    Gravação / Write
                  </span>
                </div>

                {/* 4. Cache Out / Read (Hit) */}
                <div className="p-3 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl flex flex-col justify-between ring-1 ring-emerald-500/20">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1">
                    <Target className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Cache Out</span>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                      ${pricing.cacheHitPerMillion.toFixed(3)}
                    </div>
                    <div className="text-[10px] text-[var(--text-dim)] font-mono">
                      ~R$ {cacheHitBrl.toFixed(2)} / 1M
                    </div>
                  </div>
                  <span className="text-[9px] text-emerald-800 dark:text-emerald-300 font-bold mt-1.5 block border-t border-[var(--border-main)] pt-1">
                    {pricing.savingsPct ? `-${pricing.savingsPct}% desconto` : 'Leitura / Hit'}
                  </span>
                </div>
              </div>
            </div>

            {/* API Key Input */}
            <div>
              <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5">
                {t('apiKeyStatus')}
              </label>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {activeKeyInfo.hasKey ? (
                  <>
                    <Badge variant="success">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{t('keyConfigured')}</span>
                    </Badge>
                    <code className="text-xs font-mono text-[var(--accent)] bg-[var(--accent-subtle)] px-2 py-0.5 rounded border border-[var(--accent-border)] font-bold">
                      {activeKeyInfo.masked}
                    </code>
                  </>
                ) : (
                  <Badge variant="warning" className="bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300">
                    <AlertCircle className="w-3 h-3" />
                    <span>Nenhuma chave configurada para {activeMeta.name}</span>
                  </Badge>
                )}
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
