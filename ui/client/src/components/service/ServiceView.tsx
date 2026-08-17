import React, { useState, useEffect } from 'react'
import { Cpu, RefreshCw, Smartphone, Key, Check, Copy, Activity, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { ApiClient } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export const ServiceView: React.FC = () => {
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

  useEffect(() => {
    loadServiceData()
  }, [])

  const loadServiceData = async () => {
    try {
      const data = await ApiClient.getServiceStatus()
      setContainers(data.dockerContainers || [])
      setStatusInfo({
        active: data.active,
        statusText: data.statusText,
        uptime: data.uptime,
        mainPid: data.mainPid,
      })
    } catch {}
  }

  const handleGeneratePairing = async () => {
    setIsGeneratingPairing(true)
    try {
      const data = await ApiClient.generateTelegramPairing('barao')
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
        icon={<Cpu className="w-5 h-5" />}
        title="Gerenciamento do Daemon & Pareamento"
        subtitle="Controle de processos em segundo plano, contêineres Docker e autorização de canais."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={loadServiceData}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar Status</span>
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {/* Host Service & Docker Manager */}
        <Card className="border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs overflow-hidden flex flex-col justify-between">
          <CardHeader className="p-5 bg-[var(--bg-card-subtle)] border-b border-[var(--border-main)]">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm sm:text-base font-bold text-[var(--text-main)] flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                <span>Daemon do Host & Contêineres Docker</span>
              </CardTitle>
              <Badge variant={statusInfo.active ? 'success' : 'destructive'}>
                <CheckCircle2 className="w-3 h-3" />
                <span>{statusInfo.active ? 'Daemon Online' : 'Daemon Inativo'}</span>
              </Badge>
            </div>
            <CardDescription className="text-xs text-[var(--text-muted)] mt-1">
              Controle de processos em segundo plano e contêineres Docker isolados sob demanda.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-6">
            {/* Status overview metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)]">
                <span className="text-[10px] uppercase font-bold text-[var(--text-dim)] block">PID do Daemon</span>
                <span className="font-mono text-sm font-bold text-[var(--text-main)]">
                  {statusInfo.mainPid ? String(statusInfo.mainPid) : '--'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)]">
                <span className="text-[10px] uppercase font-bold text-[var(--text-dim)] block">Status do Sistema</span>
                <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate block">
                  {statusInfo.statusText || 'Em Execução'}
                </span>
              </div>
            </div>

            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              O daemon roda no host e spawna contêineres Docker isolados <strong>sob demanda</strong> a cada mensagem ou execução de ferramenta para garantir 100% de segurança e contenção.
            </p>

            <div>
              <div className="text-[11px] font-mono uppercase font-bold text-[var(--text-dim)] mb-2 flex items-center justify-between">
                <span>Contêineres Docker Ativos no Host:</span>
                <span className="text-[10px] text-[var(--text-muted)]">{containers.length} detectados</span>
              </div>

              <div className="space-y-2">
                {containers.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)] font-mono text-xs text-[var(--text-dim)]">
                    Nenhum contêiner rodando no momento (ocioso).
                  </div>
                ) : (
                  containers.map((c, i) => {
                    const text = typeof c === 'string' ? c : c.name || c.id || String(c)
                    return (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)] font-mono text-xs text-[var(--text-main)] flex items-center justify-between gap-2 shadow-xs"
                      >
                        <span className="font-semibold text-[var(--accent)]">{text}</span>
                        <Badge variant="success" className="text-[10px] py-0 px-2 shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Ativo</span>
                        </Badge>
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
        <Card className="border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs overflow-hidden flex flex-col justify-between">
          <CardHeader className="p-5 bg-[var(--bg-card-subtle)] border-b border-[var(--border-main)]">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm sm:text-base font-bold text-[var(--text-main)] flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[var(--accent)]" />
                <span>Pareamento do Telegram</span>
              </CardTitle>
              <Badge variant="default">1-Clique</Badge>
            </div>
            <CardDescription className="text-xs text-[var(--text-muted)] mt-1">
              Gere um código de autorização para vincular novos usuários ou canais ao Barão.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-6">
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Envie este código para o bot no Telegram para vincular instantaneamente seu ID à conta autorizada sem precisar de aprovação manual posterior.
            </p>

            <div className="p-5 rounded-2xl bg-[var(--bg-card-subtle)] border border-[var(--border-main)] flex items-center justify-between gap-3 shadow-xs">
              <span className="font-mono text-base sm:text-lg font-bold text-[var(--accent)] tracking-wider">
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
    </div>
  )
}
