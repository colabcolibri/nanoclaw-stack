import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiClient } from '@/api/client'
import type { IntegrationId } from '@/components/mcps/integration-definitions'
import { useDefaultGroup } from '@/contexts/AppConfigContext'

type NotionStatus = {
  connected: boolean
  maskedKey?: string
  botName?: string
  defaultDatabaseId?: string
}

type YampiStatus = {
  connected: boolean
  alias?: string
  maskedUserToken?: string
  maskedUserSecret?: string
}

export function useIntegrations() {
  const group = useDefaultGroup()
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; email?: string }>({ connected: false })
  const [googlePolicy, setGooglePolicy] = useState<{ mode: string; emailSender: string }>({
    mode: 'draft_approval',
    emailSender: 'Assistente Virtual da Colibri <contato@colabcolibri.com>',
  })
  const [notionStatus, setNotionStatus] = useState<NotionStatus>({ connected: false })
  const [notionApiKey, setNotionApiKey] = useState('')
  const [notionDbId, setNotionDbId] = useState('')
  const [yampiStatus, setYampiStatus] = useState<YampiStatus>({ connected: false })
  const [yampiAlias, setYampiAlias] = useState('')
  const [yampiToken, setYampiToken] = useState('')
  const [yampiSecret, setYampiSecret] = useState('')
  const [macConfig, setMacConfig] = useState<{ apiKey: string; endpoint: string; group: string }>({
    apiKey: '',
    endpoint: '',
    group: '',
  })
  const [shippingConfig, setShippingConfig] = useState({
    originCep: '12243-380',
    priceMarginPct: 30,
    leadTimeDaysBuffer: 3,
  })
  const [customMcpsJson, setCustomMcpsJson] = useState('{\n  "mcpServers": {}\n}')
  const [activeSheet, setActiveSheet] = useState<IntegrationId | null>(null)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 3000)
  }, [])

  const loadAllIntegrations = useCallback(async () => {
    setIsLoading(true)
    try {
      const [gStat, nStat, yStat, macCfg, shipCfg, mcpsData, gPolicy] = await Promise.all([
        ApiClient.getGoogleStatus(group).catch(() => ({ connected: false })),
        ApiClient.getNotionStatus(group).catch(() => ({ connected: false })),
        ApiClient.getYampiStatus(group).catch(() => ({ connected: false })),
        ApiClient.getMacConfig(group),
        ApiClient.getShippingConfig().catch(() => ({
          originCep: '12243-380',
          priceMarginPct: 30,
          leadTimeDaysBuffer: 3,
        })),
        ApiClient.getMcps(group).catch(() => ({ mcps: {} })),
        ApiClient.getGooglePolicy(group).catch(() => null),
      ])

      setGoogleStatus(gStat)
      setNotionStatus(nStat)
      setNotionDbId('defaultDatabaseId' in nStat ? nStat.defaultDatabaseId || '' : '')
      setNotionApiKey('')
      setYampiStatus(yStat)
      setYampiAlias('alias' in yStat ? yStat.alias || '' : '')
      setYampiToken('')
      setYampiSecret('')
      setMacConfig({
        ...macCfg,
        group: macCfg.group,
      })
      setShippingConfig(shipCfg)

      const mcpServers = mcpsData.mcps || {}
      setCustomMcpsJson(JSON.stringify({ mcpServers }, null, 2))

      if (gPolicy?.mode) {
        setGooglePolicy(gPolicy)
      }
    } catch {
      showToast('Erro ao carregar integrações.', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast, group])

  useEffect(() => {
    loadAllIntegrations()
  }, [loadAllIntegrations])

  const mcpServerRows = useMemo(() => {
    try {
      const parsed = JSON.parse(customMcpsJson)
      const servers = parsed?.mcpServers ?? parsed ?? {}
      return Object.entries(servers as Record<string, Record<string, unknown>>).map(([name, cfg]) => ({
        name,
        transport: cfg.url ? 'SSE/HTTP' : 'STDIO',
        endpoint: String(cfg.url ?? cfg.command ?? '—'),
      }))
    } catch {
      return []
    }
  }, [customMcpsJson])

  const connectedCount = useMemo(() => {
    let count = 0
    if (googleStatus.connected) count++
    if (notionStatus.connected) count++
    if (yampiStatus.connected) count++
    count += 2
    return count
  }, [googleStatus.connected, notionStatus.connected, yampiStatus.connected])

  const handleConnectGoogle = async () => {
    try {
      const { url } = await ApiClient.getGoogleConnectUrl(group)
      if (url) window.location.href = url
    } catch {
      showToast('Erro ao iniciar conexão com o Google.', 'error')
    }
  }

  const handleDisconnectGoogle = async () => {
    if (!confirm('Deseja realmente desconectar a conta Google?')) return
    try {
      await ApiClient.disconnectGoogle(group)
      setGoogleStatus({ connected: false })
      showToast('Conta Google desconectada.')
    } catch {
      showToast('Erro ao desconectar Google.', 'error')
    }
  }

  const handleSaveGooglePolicy = async () => {
    try {
      await ApiClient.saveGooglePolicy(group, googlePolicy.mode, googlePolicy.emailSender)
      showToast('Política de e-mail salva com sucesso!')
      setActiveSheet(null)
    } catch {
      showToast('Erro ao salvar política de e-mail.', 'error')
    }
  }

  const handleSaveNotion = async () => {
    if (!notionStatus.connected && !notionApiKey.trim()) {
      showToast('Informe a chave de API do Notion.', 'error')
      return
    }
    try {
      await ApiClient.connectNotion(group, notionApiKey.trim(), notionDbId.trim() || undefined)
      setActiveSheet(null)
      showToast('Notion salvo com sucesso!')
      await loadAllIntegrations()
    } catch {
      showToast('Erro ao conectar com o Notion.', 'error')
    }
  }

  const handleDisconnectNotion = async () => {
    if (!confirm('Deseja desconectar o Notion?')) return
    try {
      await ApiClient.disconnectNotion(group)
      setNotionStatus({ connected: false })
      setNotionDbId('')
      setNotionApiKey('')
      showToast('Notion desconectado.')
    } catch {
      showToast('Erro ao desconectar Notion.', 'error')
    }
  }

  const handleSaveYampi = async () => {
    if (!yampiAlias.trim()) {
      showToast('Informe o alias da loja Yampi.', 'error')
      return
    }
    if (!yampiStatus.connected && (!yampiToken.trim() || !yampiSecret.trim())) {
      showToast('Preencha todas as credenciais da Yampi.', 'error')
      return
    }
    try {
      await ApiClient.connectYampi(group, yampiAlias.trim(), yampiToken.trim(), yampiSecret.trim())
      setActiveSheet(null)
      showToast('Yampi salva com sucesso!')
      await loadAllIntegrations()
    } catch {
      showToast('Erro ao conectar com a Yampi.', 'error')
    }
  }

  const handleDisconnectYampi = async () => {
    if (!confirm('Deseja desconectar a Yampi?')) return
    try {
      await ApiClient.disconnectYampi(group)
      setYampiStatus({ connected: false })
      setYampiAlias('')
      setYampiToken('')
      setYampiSecret('')
      showToast('Yampi desconectada.')
    } catch {
      showToast('Erro ao desconectar Yampi.', 'error')
    }
  }

  const handleSaveShipping = async () => {
    try {
      await ApiClient.saveShippingConfig(
        shippingConfig.originCep,
        Number(shippingConfig.priceMarginPct),
        Number(shippingConfig.leadTimeDaysBuffer)
      )
      showToast('Configurações de frete salvas com sucesso!')
      setActiveSheet(null)
      await loadAllIntegrations()
    } catch {
      showToast('Erro ao salvar configurações de frete.', 'error')
    }
  }

  const handleSaveCustomMcps = async () => {
    try {
      const parsed = JSON.parse(customMcpsJson)
      await ApiClient.saveMcps(group, parsed)
      showToast('Servidores MCP salvos com sucesso!')
      await loadAllIntegrations()
    } catch {
      showToast('JSON inválido nos servidores MCP.', 'error')
    }
  }

  return {
    googleStatus,
    googlePolicy,
    setGooglePolicy,
    notionStatus,
    notionApiKey,
    setNotionApiKey,
    notionDbId,
    setNotionDbId,
    yampiStatus,
    yampiAlias,
    setYampiAlias,
    yampiToken,
    setYampiToken,
    yampiSecret,
    setYampiSecret,
    macConfig,
    shippingConfig,
    setShippingConfig,
    customMcpsJson,
    setCustomMcpsJson,
    activeSheet,
    setActiveSheet,
    toastMessage,
    isLoading,
    mcpServerRows,
    connectedCount,
    loadAllIntegrations,
    handleConnectGoogle,
    handleDisconnectGoogle,
    handleSaveGooglePolicy,
    handleSaveNotion,
    handleDisconnectNotion,
    handleSaveYampi,
    handleDisconnectYampi,
    handleSaveShipping,
    handleSaveCustomMcps,
  }
}
