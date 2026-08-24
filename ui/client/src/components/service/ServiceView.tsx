import React, { useState, useEffect } from 'react'
import { useDefaultGroup } from '@/contexts/AppConfigContext'
import { RefreshCw, Smartphone, Key, Check, Copy, Activity, CheckCircle2, Radio, MessageSquare, Trash2 } from 'lucide-react'
import { ApiClient, type ConnectedChannelItem } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChannelBadge, resolveChannelKind } from '@/components/templates/ChannelBadge'
import { StatusBadge } from '@/components/templates/StatusBadge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { ClearChatCostsDialog } from '@/components/service/ClearChatCostsDialog'
import {

  formatEngageMode,
  formatSenderPolicy,
  getChannelDisplayName,
  getChannelLabel,
} from '@/components/service/channel-utils'
import { formatDate } from '../../lib/formatters'

export const ServiceView: React.FC = () => {
  const group = useDefaultGroup()
  const [containers, setContainers] = useState<any[]>([])
  const [statusInfo, setStatusInfo] = useState<{
    active: boolean
    statusText: string
    uptime?: string
    mainPid?: number
  }>({ active: false, statusText: 'Verificando...' })
  const [pairingCode, setPairingCode] = useState<string>('')
  const [isGeneratingPairing, setIsGeneratingPairing] = useState<boolean>(false)
  const [isRestarting, setIsRestarting] = useState<boolean>(false)
  const [copiedCode, setCopiedCode] = useState<boolean>(false)
  const [channels, setChannels] = useState<ConnectedChannelItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false)

  useEffect(() => {
    loadServiceData()
  }, [])

  const loadServiceData = async () => {
    setIsLoading(true)
    try {
      const [data, channelsData] = await Promise.all([
        ApiClient.getServiceStatus(),
        ApiClient.getConnectedChannels().catch(() => ({ channels: [] })),
      ])
      setContainers(data.dockerContainers || [])
      setChannels(channelsData.channels || [])
      setStatusInfo({
        active: data.active,
        statusText: data.statusText,
        uptime: data.uptime,
        mainPid: data.mainPid,
      })
    } catch {} finally {
      setIsLoading(false)
    }
  }

  const handleGeneratePairing = async () => {
    setIsGeneratingPairing(true)
    try {
      const data = await ApiClient.generateTelegramPairing(group)
      setPairingCode(data.code || 'CODE-1234')
    } catch {
      setPairingCode('ERRO-GERAR')
    } finally {
      setIsGeneratingPairing(false)
    }
  }

  const handleCopyPairing = async () => {
    if (!pairingCode) return
    try {
      await navigator.clipboard.writeText(pairingCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch {}
  }

  const handleRestart = async () => {
    if (!confirm('Deseja realmente reiniciar o serviço NanoClaw?')) return
    setIsRestarting(true)
    try {
      await ApiClient.restartService()
      alert('Comando de reinicialização enviado com sucesso!')
      setTimeout(loadServiceData, 2000)
    } catch {
      alert('Erro ao enviar sinal de reinicialização.')
    } finally {
      setIsRestarting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full flex-1">
      <PageHeader
        view="service"
        subtitle="Status do daemon, contêineres Docker, pareamento de dispositivos e canais conectados."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={loadServiceData}
            disabled={isLoading}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar Status</span>
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {/* Host Service & Docker Manager */}
        <Card className="border-(--border-main) bg-(--bg-card) shadow-xs overflow-hidden flex flex-col justify-between">
          <CardHeader className="p-5 bg-(--bg-card-subtle) border-b border-(--border-main)">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm sm:text-base font-bold text-(--text-main) flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                <span>Daemon do Host & Contêineres Docker</span>
              </CardTitle>
              {statusInfo.active ? (
                <StatusBadge>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Daemon Online</span>
                </StatusBadge>
              ) : (
                <Badge variant="destructive">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Daemon Inativo</span>
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs text-(--text-muted) mt-1">
              Controle de processos em segundo plano e contêineres Docker isolados sob demanda.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-6">
            {/* Status overview metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-(--bg-card-subtle) border border-(--border-main)">
                <span className="text-[10px] uppercase font-bold text-(--text-dim) block">PID do Daemon</span>
                <span className="font-mono text-sm font-bold text-(--text-main)">
                  {statusInfo.mainPid ? String(statusInfo.mainPid) : '--'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-(--bg-card-subtle) border border-(--border-main)">
                <span className="text-[10px] uppercase font-bold text-(--text-dim) block">Status do Sistema</span>
                <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate block">
                  {statusInfo.statusText || 'Em Execução'}
                </span>
              </div>
            </div>

            <p className="text-xs text-(--text-muted) leading-relaxed">
              O daemon roda no host e spawna contêineres Docker isolados <strong>sob demanda</strong> a cada mensagem ou execução de ferramenta para garantir 100% de segurança e contenção.
            </p>

            <div>
              <div className="text-[11px] font-mono uppercase font-bold text-(--text-dim) mb-2 flex items-center justify-between">
                <span>Contêineres Docker Ativos no Host:</span>
                <span className="text-[10px] text-(--text-muted)">{containers.length} detectados</span>
              </div>

              <div className="space-y-2">
                {containers.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-(--bg-card-subtle) border border-(--border-main) font-mono text-xs text-(--text-dim)">
                    Nenhum contêiner rodando no momento (ocioso).
                  </div>
                ) : (
                  containers.map((c, i) => {
                    const text = typeof c === 'string' ? c : c.name || c.id || String(c)
                    return (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-(--bg-card-subtle) border border-(--border-main) font-mono text-xs text-(--text-main) flex items-center justify-between gap-2 shadow-xs"
                      >
                        <span className="font-semibold text-primary">{text}</span>
                        <StatusBadge className="text-[10px] py-0 px-2 shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Ativo</span>
                        </StatusBadge>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <Button
              variant="destructive"
              onClick={handleRestart}
              disabled={isRestarting}
              className="w-full gap-2 h-10 mt-4 text-xs font-bold shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRestarting ? 'animate-spin' : ''}`} />
              <span>{isRestarting ? 'Reiniciando...' : 'Reiniciar Serviço NanoClaw'}</span>
            </Button>
          </CardContent>
        </Card>

        {/* Telegram Pairing */}
        <Card className="border-(--border-main) bg-(--bg-card) shadow-xs overflow-hidden flex flex-col justify-between">
          <CardHeader className="p-5 bg-(--bg-card-subtle) border-b border-(--border-main)">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm sm:text-base font-bold text-(--text-main) flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-primary" />
                <span>Pareamento do Telegram</span>
              </CardTitle>
              <Badge variant="default">1-Clique</Badge>
            </div>
            <CardDescription className="text-xs text-(--text-muted) mt-1">
              Gere um código de autorização para vincular novos usuários ou canais ao Barão.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-6">
            <p className="text-xs text-(--text-muted) leading-relaxed">
              Envie este código para o bot no Telegram para vincular instantaneamente seu ID à conta autorizada sem precisar de aprovação manual posterior.
            </p>

            <div className="p-5 rounded-2xl bg-(--bg-card-subtle) border border-(--border-main) flex items-center justify-between gap-3 shadow-xs">
              <span className="font-mono text-base sm:text-lg font-bold text-primary tracking-wider">
                {pairingCode || 'Clique abaixo para gerar'}
              </span>

              {pairingCode && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyPairing}
                  className="h-8 gap-1.5 text-xs font-bold"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copiado' : 'Copiar'}</span>
                </Button>
              )}
            </div>

            <Button
              onClick={handleGeneratePairing}
              disabled={isGeneratingPairing}
              className="w-full gap-2 h-10 mt-4 text-xs font-bold shadow-xs cursor-pointer"
            >
              <Key className="w-4 h-4" />
              <span>{isGeneratingPairing ? 'Gerando Código...' : 'Gerar Código de Pareamento'}</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-(--border-main) bg-(--bg-card) shadow-xs overflow-hidden w-full">
        <CardHeader className="p-5 bg-(--bg-card-subtle) border-b border-(--border-main)">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-sm sm:text-base font-bold text-(--text-main) flex items-center gap-2">
                <Radio className="w-4 h-4 text-primary" />
                <span>Canais conectados</span>
              </CardTitle>
              <CardDescription className="text-xs text-(--text-muted) mt-1">
                Chats e grupos wired ao agente no banco central (<code className="font-mono text-[10px]">messaging_groups</code>).
              </CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit text-[10px] font-semibold">
              {channels.length} {channels.length === 1 ? 'canal' : 'canais'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-5">
          {channels.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="w-6 h-6 text-(--text-dim)" />}
              title="Nenhum canal wired"
              description="Quando alguém falar com o bot ou um canal for registrado no setup, ele aparece aqui."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {channels.map((channel) => {
                const isDenied = Boolean(channel.deniedAt)
                const displayName = getChannelDisplayName(channel)

                return (
                  <div
                    key={channel.id}
                    className="rounded-xl border border-(--border-main) bg-(--bg-card-subtle) p-4 flex flex-col gap-3 min-w-0"
                  >
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-(--text-main)">{displayName}</p>
                        <p className="truncate font-mono text-[10px] text-(--text-dim) mt-0.5">{channel.platformId}</p>
                      </div>
                      {isDenied ? (
                        <Badge variant="destructive" className="shrink-0 text-[10px]">
                          Negado
                        </Badge>
                      ) : (
                        <StatusBadge className="shrink-0 text-[10px]">
                          Conectado
                        </StatusBadge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <ChannelBadge channel={resolveChannelKind(channel.channelType)} className="text-[10px]">
                        {getChannelLabel(channel.channelType)}
                      </ChannelBadge>
                      {channel.isGroup && (
                        <Badge variant="secondary" className="text-[10px]">
                          Grupo
                        </Badge>
                      )}
                      {channel.agentGroupName && (
                        <Badge variant="outline" className="text-[10px]">
                          {channel.agentGroupName}
                        </Badge>
                      )}
                    </div>

                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
                      <div className="min-w-0">
                        <dt className="uppercase font-bold text-(--text-dim)">Agente</dt>
                        <dd className="truncate text-(--text-main)">{channel.agentFolder || '—'}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="uppercase font-bold text-(--text-dim)">Engajamento</dt>
                        <dd className="truncate text-(--text-main)">{formatEngageMode(channel.engageMode)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="uppercase font-bold text-(--text-dim)">Remetentes</dt>
                        <dd className="truncate text-(--text-main)">{formatSenderPolicy(channel.unknownSenderPolicy)}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="uppercase font-bold text-(--text-dim)">Desde</dt>
                        <dd className="truncate text-(--text-main)">
                          {formatDate(channel.createdAt)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-red-500/20 bg-(--bg-card) shadow-xs overflow-hidden w-full">
        <CardHeader className="p-5 bg-(--bg-card-subtle) border-b border-(--border-main)">
          <CardTitle className="text-sm sm:text-base font-bold text-(--text-main) flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-500" />
            <span>Manutenção de dados</span>
          </CardTitle>
          <CardDescription className="text-xs text-(--text-muted) mt-1">
            Remove todo o histórico de conversas e custos do banco. Use apenas se precisar começar do zero.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-(--text-muted) leading-relaxed max-w-2xl">
            Apaga mensagens, contexto LLM das sessões ativas, sessões arquivadas e ledgers de token/custo.
            Canais, agentes, usuários e configurações permanecem intactos.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setPurgeDialogOpen(true)}
            className="shrink-0 gap-2 text-xs font-bold"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar chat e custos</span>
          </Button>
        </CardContent>
      </Card>

      <ClearChatCostsDialog
        open={purgeDialogOpen}
        onOpenChange={setPurgeDialogOpen}
        onSuccess={() => {
          alert('Chat e custos limpos com sucesso.')
        }}
      />
    </div>
  )
}
