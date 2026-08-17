import React, { useState, useEffect } from 'react'
import {
  Link2,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Calendar,
  Mail,
  FileText,
  ShoppingBag,
  Laptop,
  Truck,
  Wrench,
  Settings,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'
import { ApiClient } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export const McpsView: React.FC = () => {
  // Google state
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; email?: string }>({ connected: false })
  const [isGooglePolicyOpen, setIsGooglePolicyOpen] = useState<boolean>(false)
  const [googlePolicy, setGooglePolicy] = useState<{ mode: string; emailSender: string }>({
    mode: 'draft_approval',
    emailSender: 'Assistente Virtual da Colibri <contato@colabcolibri.com>',
  })

  // Notion state
  const [notionStatus, setNotionStatus] = useState<{ connected: boolean; workspaceName?: string }>({ connected: false })
  const [isNotionOpen, setIsNotionOpen] = useState<boolean>(false)
  const [notionApiKey, setNotionApiKey] = useState<string>('')
  const [notionDbId, setNotionDbId] = useState<string>('')

  // Yampi state
  const [yampiStatus, setYampiStatus] = useState<{ connected: boolean; alias?: string }>({ connected: false })
  const [isYampiOpen, setIsYampiOpen] = useState<boolean>(false)
  const [yampiAlias, setYampiAlias] = useState<string>('')
  const [yampiToken, setYampiToken] = useState<string>('')
  const [yampiSecret, setYampiSecret] = useState<string>('')

  // Mac state
  const [isMacOpen, setIsMacOpen] = useState<boolean>(false)
  const [macConfig, setMacConfig] = useState<{ apiKey: string; endpoint: string; group: string }>({
    apiKey: '',
    endpoint: 'https://uai.sergioluciano.com/api/mac/prompt',
    group: 'barao',
  })
  const [copiedMacEndpoint, setCopiedMacEndpoint] = useState<boolean>(false)
  const [copiedMacKey, setCopiedMacKey] = useState<boolean>(false)

  // Shipping state
  const [isShippingOpen, setIsShippingOpen] = useState<boolean>(false)
  const [shippingConfig, setShippingConfig] = useState<{ originCep: string; priceMarginPct: number; leadTimeDaysBuffer: number }>({
    originCep: '12243-380',
    priceMarginPct: 30,
    leadTimeDaysBuffer: 3,
  })

  // Custom MCPs state
  const [customMcpsJson, setCustomMcpsJson] = useState<string>('{\n  "mcpServers": {}\n}')
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadAllIntegrations()
  }, [])

  const loadAllIntegrations = async () => {
    try {
      const [gStat, nStat, yStat, macCfg, shipCfg, mcpsData] = await Promise.all([
        ApiClient.getGoogleStatus('barao').catch(() => ({ connected: false })),
        ApiClient.getNotionStatus('barao').catch(() => ({ connected: false })),
        ApiClient.getYampiStatus('barao').catch(() => ({ connected: false })),
        ApiClient.getMacConfig('barao').catch(() => ({ apiKey: '', endpoint: 'https://uai.sergioluciano.com/api/mac/prompt', group: 'barao' })),
        ApiClient.getShippingConfig().catch(() => ({ originCep: '12243-380', priceMarginPct: 30, leadTimeDaysBuffer: 3 })),
        ApiClient.getMcps('barao').catch(() => ({ mcps: {} })),
      ])

      setGoogleStatus(gStat)
      setNotionStatus(nStat)
      setYampiStatus(yStat)
      setMacConfig(macCfg)
      setShippingConfig(shipCfg)
      setCustomMcpsJson(JSON.stringify(mcpsData.mcps || {}, null, 2))

      ApiClient.getGooglePolicy('barao').then((pol) => {
        if (pol.mode) setGooglePolicy(pol)
      }).catch(() => {})
    } catch {}
  }

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleConnectGoogle = async () => {
    try {
      const { url } = await ApiClient.getGoogleConnectUrl('barao')
      if (url) window.location.href = url
    } catch {
      showToast('Erro ao iniciar conexão com o Google.', 'error')
    }
  }

  const handleDisconnectGoogle = async () => {
    if (!confirm('Deseja realmente desconectar a conta Google?')) return
    try {
      await ApiClient.disconnectGoogle('barao')
      setGoogleStatus({ connected: false })
      showToast('Conta Google desconectada.')
    } catch {
      showToast('Erro ao desconectar Google.', 'error')
    }
  }

  const handleSaveGooglePolicy = async () => {
    try {
      await ApiClient.saveGooglePolicy('barao', googlePolicy.mode, googlePolicy.emailSender)
      showToast('Política de e-mail salva com sucesso!')
      setIsGooglePolicyOpen(false)
    } catch {
      showToast('Erro ao salvar política de e-mail.', 'error')
    }
  }

  const handleSaveNotion = async () => {
    if (!notionApiKey.trim()) return
    try {
      await ApiClient.connectNotion('barao', notionApiKey.trim(), notionDbId.trim() || undefined)
      setNotionStatus({ connected: true })
      setIsNotionOpen(false)
      showToast('Notion conectado com sucesso!')
    } catch {
      showToast('Erro ao conectar com o Notion.', 'error')
    }
  }

  const handleDisconnectNotion = async () => {
    if (!confirm('Deseja desconectar o Notion?')) return
    try {
      await ApiClient.disconnectNotion('barao')
      setNotionStatus({ connected: false })
      showToast('Notion desconectado.')
    } catch {
      showToast('Erro ao desconectar Notion.', 'error')
    }
  }

  const handleSaveYampi = async () => {
    if (!yampiAlias.trim() || !yampiToken.trim() || !yampiSecret.trim()) {
      showToast('Preencha todas as credenciais da Yampi.', 'error')
      return
    }
    try {
      await ApiClient.connectYampi('barao', yampiAlias.trim(), yampiToken.trim(), yampiSecret.trim())
      setYampiStatus({ connected: true, alias: yampiAlias.trim() })
      setIsYampiOpen(false)
      showToast('Yampi conectada com sucesso!')
    } catch {
      showToast('Erro ao conectar com a Yampi.', 'error')
    }
  }

  const handleDisconnectYampi = async () => {
    if (!confirm('Deseja desconectar a Yampi?')) return
    try {
      await ApiClient.disconnectYampi('barao')
      setYampiStatus({ connected: false })
      showToast('Yampi desconectada.')
    } catch {
      showToast('Erro ao desconectar Yampi.', 'error')
    }
  }

  const handleSaveShipping = async () => {
    try {
      await ApiClient.saveShippingConfig(shippingConfig.originCep, Number(shippingConfig.priceMarginPct), Number(shippingConfig.leadTimeDaysBuffer))
      showToast('Configurações de frete salvas com sucesso!')
      setIsShippingOpen(false)
    } catch {
      showToast('Erro ao salvar configurações de frete.', 'error')
    }
  }

  const handleSaveCustomMcps = async () => {
    try {
      const parsed = JSON.parse(customMcpsJson)
      await ApiClient.saveMcps('barao', parsed)
      showToast('Servidores MCP salvos com sucesso!')
    } catch {
      showToast('JSON inválido nos servidores MCP.', 'error')
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full flex-1">
      {/* Toast Banner */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 animate-in fade-in ${
            toastMessage.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-900 dark:text-emerald-300'
              : 'bg-red-500/15 border-red-500/30 text-red-900 dark:text-red-300'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      <PageHeader
        icon={<Link2 className="w-5 h-5" />}
        title="Contas, Serviços Conectados & Protocolo MCP"
        subtitle="Gerencie as conexões oficiais do seu assistente (Google, Notion, Yampi, macOS, Correios) e servidores MCP."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllIntegrations}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar Status</span>
          </Button>
        }
      />

      <div className="space-y-4 w-full">
        {/* 1. GOOGLE WORKSPACE */}
        <Card className="border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs overflow-hidden w-full">
          <CardHeader className="p-5 bg-[var(--bg-card-subtle)] border-b border-[var(--border-main)]">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left text div */}
              <div className="flex items-start gap-4 flex-1">
                <div className="w-11 h-11 rounded-xl bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-500/50 flex items-center justify-center shrink-0 shadow-xs">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-sm sm:text-base font-bold text-[var(--text-main)]">
                    Google Workspace (Google Calendar & Gmail)
                  </CardTitle>
                  <CardDescription className="text-xs text-[var(--text-muted)] leading-relaxed font-normal">
                    Permite ao Barão ler sua agenda, criar reuniões e checar seus e-mails.
                  </CardDescription>
                </div>
              </div>

              {/* Right actions div */}
              <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center">
                <Badge variant={googleStatus.connected ? 'success' : 'destructive'}>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{googleStatus.connected ? `Conectado ${googleStatus.email ? `(${googleStatus.email})` : ''}` : 'Desconectado'}</span>
                </Badge>

                {googleStatus.connected && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsGooglePolicyOpen(!isGooglePolicyOpen)}
                    className="h-8 text-xs font-semibold gap-1.5 border-[var(--border-main)]"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Política de E-mails</span>
                  </Button>
                )}

                {!googleStatus.connected ? (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleConnectGoogle}
                    className="h-8 gap-1.5 text-xs font-bold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Conectar Conta Google</span>
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDisconnectGoogle}
                    className="h-8 text-xs font-semibold"
                  >
                    Desconectar
                  </Button>
                )}
              </div>
            </div>

            {/* Email Policy Drawer */}
            {isGooglePolicyOpen && (
              <div className="mt-4 pt-4 border-t border-[var(--border-main)] space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                      Modo de Atendimento Autônomo de E-mails
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] focus:outline-none focus:border-sky-500"
                      value={googlePolicy.mode}
                      onChange={(e) => setGooglePolicy({ ...googlePolicy, mode: e.target.value })}
                    >
                      <option value="draft_approval">Rascunho no Gmail & Aprovação no Telegram (Recomendado)</option>
                      <option value="auto_safe">Resposta Autônoma em Casos Seguros + Aprovação em Orçamentos</option>
                      <option value="notify_only">Apenas Notificar no Telegram (Sem Ação no Gmail)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                      Remetente Oficial (Alias)
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] focus:outline-none focus:border-sky-500"
                      value={googlePolicy.emailSender}
                      onChange={(e) => setGooglePolicy({ ...googlePolicy, emailSender: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setIsGooglePolicyOpen(false)} className="h-8 text-xs">
                    Fechar
                  </Button>
                  <Button variant="default" size="sm" onClick={handleSaveGooglePolicy} className="h-8 text-xs font-bold">
                    Salvar Política
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
        </Card>

        {/* 2. NOTION WORKSPACE */}
        <Card className="border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs overflow-hidden w-full">
          <CardHeader className="p-5 bg-[var(--bg-card-subtle)] border-b border-[var(--border-main)]">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left text div */}
              <div className="flex items-start gap-4 flex-1">
                <div className="w-11 h-11 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-500/50 flex items-center justify-center shrink-0 shadow-xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-sm sm:text-base font-bold text-[var(--text-main)]">
                    Notion (Anotações, Atas & Databases)
                  </CardTitle>
                  <CardDescription className="text-xs text-[var(--text-muted)] leading-relaxed font-normal">
                    Permite ao Barão criar notas estruturadas, salvar resumos e gerenciar tabelas no Notion.
                  </CardDescription>
                </div>
              </div>

              {/* Right actions div */}
              <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center">
                <Badge variant={notionStatus.connected ? 'success' : 'secondary'}>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{notionStatus.connected ? 'Conectado' : 'Desconectado'}</span>
                </Badge>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNotionOpen(!isNotionOpen)}
                  className="h-8 text-xs font-semibold gap-1.5 border-[var(--border-main)]"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Configurar Notion</span>
                </Button>

                {notionStatus.connected && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDisconnectNotion}
                    className="h-8 text-xs font-semibold"
                  >
                    Desconectar
                  </Button>
                )}
              </div>
            </div>

            {/* Notion Config Drawer */}
            {isNotionOpen && (
              <div className="mt-4 pt-4 border-t border-[var(--border-main)] space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                      Internal Integration Secret / API Token
                    </label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs font-mono text-[var(--text-input)] focus:outline-none focus:border-sky-500"
                      placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={notionApiKey}
                      onChange={(e) => setNotionApiKey(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                      Database ID Padrão (Opcional)
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs font-mono text-[var(--text-input)] focus:outline-none focus:border-sky-500"
                      placeholder="Ex: 1a2b3c4d5e6f..."
                      value={notionDbId}
                      onChange={(e) => setNotionDbId(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setIsNotionOpen(false)} className="h-8 text-xs">
                    Cancelar
                  </Button>
                  <Button variant="default" size="sm" onClick={handleSaveNotion} className="h-8 text-xs font-bold">
                    Testar & Salvar Conexão
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
        </Card>

        {/* 3. YAMPI E-COMMERCE */}
        <Card className="border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs overflow-hidden w-full">
          <CardHeader className="p-5 bg-[var(--bg-card-subtle)] border-b border-[var(--border-main)]">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left text div */}
              <div className="flex items-start gap-4 flex-1">
                <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/50 flex items-center justify-center shrink-0 shadow-xs">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-sm sm:text-base font-bold text-[var(--text-main)]">
                    Yampi (Loja Virtual & E-commerce)
                  </CardTitle>
                  <CardDescription className="text-xs text-[var(--text-muted)] leading-relaxed font-normal">
                    Permite ao Barão consultar catálogo de produtos, checar estoque e rastrear pedidos.
                  </CardDescription>
                </div>
              </div>

              {/* Right actions div */}
              <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center">
                <Badge variant={yampiStatus.connected ? 'success' : 'secondary'}>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{yampiStatus.connected ? `Conectado (${yampiStatus.alias || 'Loja'})` : 'Desconectado'}</span>
                </Badge>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsYampiOpen(!isYampiOpen)}
                  className="h-8 text-xs font-semibold gap-1.5 border-[var(--border-main)]"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Configurar Yampi</span>
                </Button>

                {yampiStatus.connected && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDisconnectYampi}
                    className="h-8 text-xs font-semibold"
                  >
                    Desconectar
                  </Button>
                )}
              </div>
            </div>

            {/* Yampi Config Drawer */}
            {isYampiOpen && (
              <div className="mt-4 pt-4 border-t border-[var(--border-main)] space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                      Alias da Loja
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] focus:outline-none focus:border-sky-500"
                      placeholder="Ex: colibri ou lojacolibri"
                      value={yampiAlias}
                      onChange={(e) => setYampiAlias(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                      User-Token
                    </label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs font-mono text-[var(--text-input)] focus:outline-none focus:border-sky-500"
                      placeholder="Token da API Yampi"
                      value={yampiToken}
                      onChange={(e) => setYampiToken(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                      User-Secret-Key
                    </label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs font-mono text-[var(--text-input)] focus:outline-none focus:border-sky-500"
                      placeholder="Secret Key da API Yampi"
                      value={yampiSecret}
                      onChange={(e) => setYampiSecret(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setIsYampiOpen(false)} className="h-8 text-xs">
                    Cancelar
                  </Button>
                  <Button variant="default" size="sm" onClick={handleSaveYampi} className="h-8 text-xs font-bold">
                    Testar & Salvar Conexão
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
        </Card>

        {/* 4. MACOS & APPLE SHORTCUTS */}
        <Card className="border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs overflow-hidden w-full">
          <CardHeader className="p-5 bg-[var(--bg-card-subtle)] border-b border-[var(--border-main)]">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left text div */}
              <div className="flex items-start gap-4 flex-1">
                <div className="w-11 h-11 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-xs">
                  <Laptop className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-sm sm:text-base font-bold text-[var(--text-main)]">
                    MacBook & Atalhos da Apple (Siri & Teclado)
                  </CardTitle>
                  <CardDescription className="text-xs text-[var(--text-muted)] leading-relaxed font-normal">
                    Envie comandos, converse por voz com a Siri ou aperte um atalho global de teclado no Mac.
                  </CardDescription>
                </div>
              </div>

              {/* Right actions div */}
              <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center">
                <Badge variant="success">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Pronto / Ativo</span>
                </Badge>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMacOpen(!isMacOpen)}
                  className="h-8 text-xs font-semibold gap-1.5 border-[var(--border-main)]"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Configurar no Mac</span>
                </Button>
              </div>
            </div>

            {/* Mac Config Drawer */}
            {isMacOpen && (
              <div className="mt-4 pt-4 border-t border-[var(--border-main)] space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                      Endpoint do Mac (HTTPS)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs font-mono text-[var(--text-input)]"
                        value={macConfig.endpoint}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          await navigator.clipboard.writeText(macConfig.endpoint)
                          setCopiedMacEndpoint(true)
                          setTimeout(() => setCopiedMacEndpoint(false), 2000)
                        }}
                        className="h-8 px-3 text-xs font-bold"
                      >
                        {copiedMacEndpoint ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                      Chave de Autenticação (Bearer Token)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        readOnly
                        className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs font-mono text-[var(--text-input)]"
                        value={macConfig.apiKey}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          await navigator.clipboard.writeText(macConfig.apiKey)
                          setCopiedMacKey(true)
                          setTimeout(() => setCopiedMacKey(false), 2000)
                        }}
                        className="h-8 px-3 text-xs font-bold"
                      >
                        {copiedMacKey ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)] text-xs text-[var(--text-muted)] leading-relaxed space-y-1.5">
                  <strong className="text-[var(--text-main)] block mb-1">Como configurar no seu Mac em 1 minuto:</strong>
                  <p>1. Abra o app <strong>Atalhos (Shortcuts)</strong> nativo do macOS.</p>
                  <p>2. Crie um novo atalho e adicione a ação <strong>"Pedir Entrada"</strong> (Texto).</p>
                  <p>3. Adicione <strong>"Obter Conteúdo do URL"</strong> apontando para o Endpoint (Método <code>POST</code>, Cabeçalho <code>Authorization: Bearer [Sua Chave]</code>, Corpo JSON com <code>prompt</code>).</p>
                  <p>4. Adicione <strong>"Obter Dicionário do Valor"</strong> (chave <code>reply</code>) e mostre a resposta.</p>
                </div>
              </div>
            )}
          </CardHeader>
        </Card>

        {/* 5. CORREIOS & LOGÍSTICA DE FRETE */}
        <Card className="border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs overflow-hidden w-full">
          <CardHeader className="p-5 bg-[var(--bg-card-subtle)] border-b border-[var(--border-main)]">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left text div */}
              <div className="flex items-start gap-4 flex-1">
                <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/50 flex items-center justify-center shrink-0 shadow-xs">
                  <Truck className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-sm sm:text-base font-bold text-[var(--text-main)]">
                    Correios & Logística de Frete (Loja Colibri)
                  </CardTitle>
                  <CardDescription className="text-xs text-[var(--text-muted)] leading-relaxed font-normal">
                    Cotação automática de PAC e SEDEX para orçamentos e propostas comerciais.
                  </CardDescription>
                </div>
              </div>

              {/* Right actions div */}
              <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center">
                <Badge variant="success">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Ativo / {shippingConfig.originCep}</span>
                </Badge>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsShippingOpen(!isShippingOpen)}
                  className="h-8 text-xs font-semibold gap-1.5 border-[var(--border-main)]"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Configurar Frete</span>
                </Button>
              </div>
            </div>

            {/* Shipping Config Drawer */}
            {isShippingOpen && (
              <div className="mt-4 pt-4 border-t border-[var(--border-main)] space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                      CEP de Origem
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs font-mono text-[var(--text-input)] focus:outline-none focus:border-sky-500"
                      value={shippingConfig.originCep}
                      onChange={(e) => setShippingConfig({ ...shippingConfig, originCep: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                      Margem de Preço (+%)
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] focus:outline-none focus:border-sky-500"
                      value={shippingConfig.priceMarginPct}
                      onChange={(e) => setShippingConfig({ ...shippingConfig, priceMarginPct: Number(e.target.value) })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-main)] mb-1">
                      Buffer de Prazo (+ Dias)
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] focus:outline-none focus:border-sky-500"
                      value={shippingConfig.leadTimeDaysBuffer}
                      onChange={(e) => setShippingConfig({ ...shippingConfig, leadTimeDaysBuffer: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setIsShippingOpen(false)} className="h-8 text-xs">
                    Cancelar
                  </Button>
                  <Button variant="default" size="sm" onClick={handleSaveShipping} className="h-8 text-xs font-bold">
                    Salvar Configurações
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
        </Card>

        {/* 6. ADVANCED CUSTOM MCP SERVERS */}
        <details className="group border border-[var(--border-main)] bg-[var(--bg-card)] rounded-xl overflow-hidden shadow-xs w-full">
          <summary className="p-5 bg-[var(--bg-card-subtle)] cursor-pointer text-xs font-bold text-[var(--text-main)] flex items-center justify-between select-none hover:bg-[var(--bg-card)] transition-colors">
            <div className="flex items-center gap-2.5">
              <Wrench className="w-4 h-4 text-[var(--accent)]" />
              <span>Servidores MCP Personalizados (Avançado / JSON)</span>
            </div>
            <span className="text-[11px] text-[var(--text-dim)] font-normal">
              Clique para expandir / registrar novos servidores MCP
            </span>
          </summary>
          <div className="p-5 border-t border-[var(--border-main)] space-y-4">
            <p className="text-xs text-[var(--text-muted)]">
              Permite registrar qualquer servidor MCP externo compatível com STDIO ou SSE.
            </p>
            <textarea
              className="w-full p-4 bg-[var(--terminal-bg)] text-[var(--terminal-text)] font-mono text-xs rounded-xl border border-[var(--border-main)] min-h-[160px] outline-none"
              value={customMcpsJson}
              onChange={(e) => setCustomMcpsJson(e.target.value)}
            />
            <div className="flex justify-end">
              <Button variant="default" size="sm" onClick={handleSaveCustomMcps} className="h-8 text-xs font-bold">
                Salvar Servidores MCP
              </Button>
            </div>
          </div>
        </details>
      </div>
    </div>
  )
}
