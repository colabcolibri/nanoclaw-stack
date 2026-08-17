import React, { useState, useEffect } from 'react'
import { Clock, RefreshCw } from 'lucide-react'
import { ApiClient, type ScheduledTask } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export const SchedulesView: React.FC = () => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)

  useEffect(() => {
    loadSchedules()
  }, [])

  const loadSchedules = async () => {
    setIsLoading(true)
    try {
      const data = await ApiClient.getSchedules()
      setTasks(data.tasks || [])
    } catch {} finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Clock className="w-5 h-5" />}
        title="Rotinas Autônomas & Agendamentos"
        subtitle="Rotinas recorrentes em segundo plano, monitoramento de e-mails e continuações programadas."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={loadSchedules}
            disabled={isLoading}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>
        }
      />

      <Card className="border-[var(--border-main)] bg-[var(--bg-card)] shadow-xl overflow-hidden">
        <CardContent className="p-6 space-y-6">
          {/* Informational Banner */}
          <div className="p-4 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-xs text-[var(--text-main)] space-y-2">
            <div className="font-bold text-[var(--accent)] flex items-center gap-1.5">
              <span>💡 Como funcionam as rotinas autônomas no NanoClaw:</span>
            </div>
            <p>
              • <strong>Watchdog do Inbox:</strong> Acorda o Barão automaticamente a cada 1 hora dentro da janela ativa configurada para checar novos e-mails não lidos.
            </p>
            <p>
              • <strong>Notificação Proativa:</strong> Se houver e-mails que precisam de resposta, o Barão redige o rascunho e te manda mensagem no Telegram para aprovação.
            </p>
            <p>
              • <strong>Continuidade Autônoma (Follow-ups):</strong> Tarefas intermediárias podem ser programadas pelo Barão (ex: aguardar 10 minutos para reprocessar dados).
            </p>
          </div>

          {/* Schedules List */}
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <EmptyState
                icon={<Clock className="w-8 h-8 text-[var(--text-dim)]" />}
                title="Sem rotinas ativas"
                description="Nenhum agendamento de cron ou watchdog pendente no momento."
              />
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card-subtle)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)] flex items-center justify-center text-xs font-mono shrink-0 mt-0.5 shadow-xs">
                      ⏰
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-xs text-[var(--text-main)] font-bold">{task.kind || 'Rotina Recorrente'}</strong>
                        <Badge variant="success" className="text-[10px] font-mono">
                          {task.status || 'ATIVO'}
                        </Badge>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">{task.prompt || 'Execução periódica de monitoramento'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono text-[var(--text-muted)] shrink-0">
                    {task.recurrence && (
                      <div>
                        <span className="text-[var(--text-dim)] text-[10px] block font-bold">RECORRÊNCIA</span>
                        <span>{task.recurrence}</span>
                      </div>
                    )}
                    {task.processAfter && (
                      <div>
                        <span className="text-[var(--text-dim)] text-[10px] block font-bold">PRÓXIMA EXECUÇÃO</span>
                        <span>{new Date(task.processAfter).toLocaleTimeString('pt-BR')}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
