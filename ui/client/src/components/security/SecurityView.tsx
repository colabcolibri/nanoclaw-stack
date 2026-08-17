import React, { useState, useEffect } from 'react'
import { ShieldCheck, RefreshCw, Users, Bell } from 'lucide-react'
import { ApiClient } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export const SecurityView: React.FC = () => {
  const [users, setUsers] = useState<any[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)

  useEffect(() => {
    loadSecurityData()
  }, [])

  const loadSecurityData = async () => {
    setIsLoading(true)
    try {
      const data = await ApiClient.getSecurity()
      setUsers(data.users || [])
      setPendingApprovals(data.pendingApprovals || [])
    } catch {} finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<ShieldCheck className="w-5 h-5" />}
        title="Central de Segurança, Usuários & Aprovações"
        subtitle="Gerencie quem tem acesso ao bot e aprove solicitações do agente."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={loadSecurityData}
            disabled={isLoading}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Authorized Users */}
        <Card className="border-[var(--border-main)] bg-[var(--bg-card)] shadow-xl overflow-hidden">
          <CardHeader className="p-5 bg-[var(--bg-card-subtle)] border-b border-[var(--border-main)]">
            <CardTitle className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--accent)]" />
              <span>👥 Usuários Autorizados no Telegram / Chat</span>
            </CardTitle>
            <CardDescription className="text-xs text-[var(--text-muted)]">
              Lista de IDs e perfis habilitados para interação com o agente.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            {users.length === 0 ? (
              <EmptyState
                icon={<Users className="w-6 h-6 text-[var(--text-dim)]" />}
                title="Sem usuários"
                description="Nenhum usuário cadastrado até o momento."
              />
            ) : (
              users.map((u, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card-subtle)] flex items-center justify-between text-xs transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--text-main)]">{u.name || u.username || 'Usuário'}</span>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {u.id || u.platformId}
                    </Badge>
                  </div>
                  <Badge variant="success">Autorizado</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card className="border-[var(--border-main)] bg-[var(--bg-card)] shadow-xl overflow-hidden">
          <CardHeader className="p-5 bg-[var(--bg-card-subtle)] border-b border-[var(--border-main)]">
            <CardTitle className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              <span>🔔 Solicitações Pendentes de Aprovação</span>
            </CardTitle>
            <CardDescription className="text-xs text-[var(--text-muted)]">
              Ações sensíveis ou novos remetentes aguardando confirmação.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            {pendingApprovals.length === 0 ? (
              <EmptyState
                icon={<Bell className="w-6 h-6 text-[var(--text-dim)]" />}
                title="Tudo limpo"
                description="Nenhuma solicitação pendente no momento."
              />
            ) : (
              pendingApprovals.map((appr, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between text-xs"
                >
                  <div>
                    <strong className="text-amber-500 block">{appr.title}</strong>
                    <span className="text-[var(--text-muted)] text-[11px]">{appr.description}</span>
                  </div>
                  <Button size="sm" className="h-7 text-xs font-semibold">
                    Aprovar
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
