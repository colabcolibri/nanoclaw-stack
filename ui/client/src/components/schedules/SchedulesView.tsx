import React, { useState, useEffect } from 'react'
import {
  Clock,
  RefreshCw,
  Lightbulb,
  Repeat,
  CheckCircle2,
  Calendar,
  Eye,
  Edit3,
  Trash2,
  Copy,
  Check,
  X,
  AlertTriangle,
  Save,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
  History,
  Activity,
  Send,
  MessageSquare,
} from 'lucide-react'
import { ApiClient, type ScheduledTask, type CronExecutionLog } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export const SchedulesView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active')
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [cronLogs, setCronLogs] = useState<CronExecutionLog[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  // Modals & Drawers State
  const [viewingTask, setViewingTask] = useState<ScheduledTask | null>(null)
  const [viewingLog, setViewingLog] = useState<CronExecutionLog | null>(null)
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null)
  const [editCron, setEditCron] = useState<string>('')
  const [editPrompt, setEditPrompt] = useState<string>('')
  const [isSaving, setIsSaving] = useState<boolean>(false)

  const [deletingTask, setDeletingTask] = useState<ScheduledTask | null>(null)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setIsLoading(true)
    try {
      const [tasksRes, logsRes] = await Promise.all([
        ApiClient.getSchedules().catch(() => ({ tasks: [] })),
        ApiClient.getCronLogs().catch(() => ({ logs: [] })),
      ])
      setTasks(tasksRes.tasks || [])
      setCronLogs(logsRes.logs || [])
    } catch {
    } finally {
      setIsLoading(false)
    }
  }

  const loadSchedules = loadAll

  const showNotify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {}
  }

  const openEditModal = (task: ScheduledTask) => {
    setEditingTask(task)
    setEditCron(task.recurrence || '0 * * * *')
    setEditPrompt(task.cleanPrompt || task.prompt || '')
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTask) return
    setIsSaving(true)
    try {
      const res = await ApiClient.updateSchedule(editingTask.id, {
        cron: editCron.trim(),
        prompt: editPrompt.trim(),
      })
      if (res.success) {
        showNotify('success', 'Rotina atualizada com sucesso!')
        setEditingTask(null)
        loadSchedules()
      } else {
        showNotify('error', 'Falha ao atualizar rotina.')
      }
    } catch (err: any) {
      showNotify('error', err.message || 'Erro ao salvar alterações.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingTask) return
    setIsDeleting(true)
    try {
      const res = await ApiClient.cancelSchedule(deletingTask.id)
      if (res.success) {
        showNotify('success', 'Rotina cancelada e excluída com sucesso!')
        setDeletingTask(null)
        loadSchedules()
      } else {
        showNotify('error', 'Falha ao excluir rotina.')
      }
    } catch (err: any) {
      showNotify('error', err.message || 'Erro ao excluir rotina.')
    } finally {
      setIsDeleting(false)
    }
  }

  const humanizeCron = (cron?: string) => {
    if (!cron) return 'Execução pontual (one-shot)'
    if (cron === '0 * * * *') return 'A cada 1 hora (no minuto :00)'
    if (cron === '0 */2 * * *') return 'A cada 2 horas'
    if (cron === '0 */3 * * *') return 'A cada 3 horas'
    if (cron === '0 */4 * * *') return 'A cada 4 horas'
    if (cron === '0 9 * * *') return 'Diariamente às 09:00 UTC (06:00 BRT)'
    if (cron === '0 12 * * *') return 'Diariamente às 12:00 UTC (09:00 BRT)'
    return `Cron: ${cron}`
  }

  return (
    <div className="flex flex-col gap-6 w-full flex-1">
      <PageHeader
        icon={<Clock className="w-5 h-5" />}
        title="Rotinas Autônomas & Agendamentos"
        subtitle="Gerenciamento de rotinas recorrentes (cron), watchdogs de monitoramento e histórico de execuções passadas."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={loadAll}
            disabled={isLoading}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>
        }
      />

      {notification && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-500'
              : 'bg-red-500/15 border border-red-500/30 text-red-500'
          }`}
        >
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="cursor-pointer opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TABS SWITCHER */}
      <div className="flex items-center gap-2 border-b border-[var(--border-main)] pb-3">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'active'
              ? 'bg-[var(--accent)] text-white shadow-xs'
              : 'bg-[var(--bg-card)] border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>Rotinas Ativas</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
            activeTab === 'active' ? 'bg-white/20 text-white' : 'bg-[var(--bg-input)] text-[var(--text-dim)]'
          }`}>
            {tasks.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-[var(--accent)] text-white shadow-xs'
              : 'bg-[var(--bg-card)] border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Histórico de Execuções (Logs)</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
            activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-[var(--bg-input)] text-[var(--text-dim)]'
          }`}>
            {cronLogs.length}
          </span>
        </button>
      </div>

      {/* TAB 1: ACTIVE SCHEDULES */}
      {activeTab === 'active' && (
        <Card className="border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs overflow-hidden w-full">
          <CardContent className="p-6 space-y-6">
            {/* Informational Banner */}
            <div className="p-4 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-xs text-[var(--text-main)] space-y-2">
              <div className="font-bold text-[var(--accent)] flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                <span>Como funcionam as rotinas ativas:</span>
              </div>
              <p>
                • <strong>Disparos Recorrentes:</strong> Esta aba exibe exclusivamente os agendamentos que estão <strong>ativos e pendentes</strong> para o próximo ciclo de execução.
              </p>
              <p>
                • <strong>Edição & Exclusão:</strong> Você pode alterar a instrução, mudar a frequência cron ou deletar agendamentos antigos a qualquer momento.
              </p>
            </div>

            {/* Schedules List */}
            <div className="space-y-4">
              {tasks.length === 0 ? (
                <EmptyState
                  icon={<Clock className="w-8 h-8 text-[var(--text-dim)]" />}
                  title="Sem rotinas ativas"
                  description="Nenhum agendamento de cron ou watchdog pendente no momento."
                />
              ) : (
                tasks.map((task) => {
                  const isExpanded = expandedTaskId === task.id
                  const displayPrompt = task.cleanPrompt || task.prompt || ''

                  return (
                    <div
                      key={task.id}
                      className="p-5 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card-subtle)] hover:border-[var(--border-accent)] transition-all flex flex-col gap-4 shadow-2xs"
                    >
                      {/* Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-main)] pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)] flex items-center justify-center shrink-0 shadow-xs">
                            {task.isRecurring ? <Repeat className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <strong className="text-sm text-[var(--text-main)] font-bold">
                                {task.isRecurring ? 'Rotina Recorrente (Cron)' : task.kind || 'Tarefa Agendada'}
                              </strong>
                              <Badge variant="success" className="text-[10px] font-mono">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{task.status?.toUpperCase() || 'PENDING'}</span>
                              </Badge>
                              {task.channelType && (
                                <Badge variant="outline" className="text-[10px] uppercase font-mono">
                                  <span>{task.channelType}</span>
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-dim)] font-mono">
                              <span>ID: {task.id}</span>
                              <button
                                onClick={() => handleCopy(task.id, task.id)}
                                className="p-1 hover:text-[var(--text-main)] cursor-pointer"
                                title="Copiar ID"
                              >
                                {copiedId === task.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingTask(task)}
                            className="h-8 gap-1.5 text-xs font-semibold"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver Completo</span>
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(task)}
                            className="h-8 gap-1.5 text-xs font-semibold text-sky-500 border-sky-500/30 hover:bg-sky-500/10"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingTask(task)}
                            className="h-8 gap-1.5 text-xs font-semibold text-red-500 border-red-500/30 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Excluir</span>
                          </Button>
                        </div>
                      </div>

                      {/* Metadata Badges & Timing */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                        {task.recurrence && (
                          <div className="p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-main)]">
                            <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase block font-mono">
                              Periodicidade (Cron)
                            </span>
                            <span className="font-bold text-[var(--accent)] font-mono block mt-0.5">
                              {task.recurrence}
                            </span>
                            <span className="text-[11px] text-[var(--text-muted)] mt-0.5 block">
                              {humanizeCron(task.recurrence)}
                            </span>
                          </div>
                        )}

                        {task.processAfter && (
                          <div className="p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-main)]">
                            <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase block font-mono">
                              Próxima Execução (Next Run)
                            </span>
                            <span className="font-bold text-[var(--text-main)] font-mono block mt-0.5">
                              {new Date(task.processAfter).toLocaleTimeString('pt-BR')} ({new Date(task.processAfter).toLocaleDateString('pt-BR')})
                            </span>
                            <span className="text-[11px] text-[var(--text-muted)] mt-0.5 block font-mono text-[10px]">
                              {task.processAfter}
                            </span>
                          </div>
                        )}

                        {task.createdAt && (
                          <div className="p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-main)]">
                            <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase block font-mono">
                              Criado em
                            </span>
                            <span className="font-semibold text-[var(--text-muted)] font-mono block mt-0.5">
                              {new Date(task.createdAt).toLocaleString('pt-BR')}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Prompt Box */}
                      <div className="p-3.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-main)] text-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                            Instrução da Tarefa (Prompt)
                          </span>
                          {displayPrompt.length > 200 && (
                            <button
                              onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                              className="text-[11px] font-semibold text-[var(--accent)] flex items-center gap-1 cursor-pointer hover:underline"
                            >
                              <span>{isExpanded ? 'Recolher' : 'Expandir Texto'}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                        <p className={`text-[var(--text-main)] leading-relaxed ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-3'}`}>
                          {displayPrompt}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: CRON EXECUTION HISTORY (LOGS) */}
      {activeTab === 'history' && (
        <Card className="border-[var(--border-main)] bg-[var(--bg-card)] shadow-xs overflow-hidden w-full">
          <CardContent className="p-6 space-y-6">
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-[var(--text-main)] space-y-1">
              <div className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-2">
                <History className="w-4 h-4" />
                <span>Histórico de Execuções e Auditoria</span>
              </div>
              <p className="text-[var(--text-muted)]">
                Registro detalhado de cada disparo automático do cron que já foi executado, incluindo a instrução processada e o relatório/resposta gerado pelo assistente.
              </p>
            </div>

            <div className="space-y-4">
              {cronLogs.length === 0 ? (
                <EmptyState
                  icon={<History className="w-8 h-8 text-[var(--text-dim)]" />}
                  title="Nenhum log de execução registrado"
                  description="Assim que as rotinas periódicas rodarem, seus históricos e relatórios aparecerão aqui."
                />
              ) : (
                cronLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id

                  return (
                    <div
                      key={log.id}
                      className="p-5 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card-subtle)] hover:border-[var(--border-accent)] transition-all flex flex-col gap-3 shadow-2xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-main)] pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                            <Activity className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <strong className="text-xs text-[var(--text-main)] font-bold font-mono">{log.id}</strong>
                              <Badge variant="success" className="text-[10px] font-mono">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>EXECUTADO</span>
                              </Badge>
                              {log.cron && (
                                <Badge variant="outline" className="text-[10px] font-mono">
                                  <span>{log.cron}</span>
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-[var(--text-dim)] font-mono block mt-0.5">
                              Disparado em: {new Date(log.timestamp).toLocaleString('pt-BR')} ({new Date(log.timestamp).toLocaleTimeString('pt-BR')})
                            </span>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingLog(log)}
                          className="h-8 gap-1.5 text-xs font-semibold shrink-0"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Detalhes do Disparo</span>
                        </Button>
                      </div>

                      {/* Prompt */}
                      <div className="p-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-main)] text-xs">
                        <span className="text-[10px] font-bold uppercase text-[var(--text-dim)] font-mono block mb-1">
                          Instrução Executada:
                        </span>
                        <p className="text-[var(--text-main)] font-mono text-[11px] line-clamp-2 leading-relaxed">
                          {log.cleanPrompt}
                        </p>
                      </div>

                      {/* Result / Output */}
                      {log.resultText && (
                        <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-1.5">
                              <Send className="w-3 h-3" />
                              <span>Resultado / Mensagem Entregue ({log.channelType}):</span>
                            </span>
                            {log.resultText.length > 200 && (
                              <button
                                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                className="text-[10px] font-semibold text-[var(--accent)] flex items-center gap-1 cursor-pointer hover:underline"
                              >
                                <span>{isExpanded ? 'Recolher' : 'Expandir Resultado'}</span>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                          <div className={`text-[var(--text-main)] leading-relaxed whitespace-pre-wrap text-[11px] ${isExpanded ? '' : 'line-clamp-3'}`}>
                            {log.resultText}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* VIEW SCHEDULE MODAL */}
      {viewingTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs cursor-pointer animate-in fade-in"
          onClick={() => setViewingTask(null)}
        >
          <div
            className="w-full max-w-2xl bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] cursor-default animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-[var(--border-main)] bg-[var(--bg-card-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)] flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">Instrução Completa da Rotina</h3>
                  <p className="text-xs font-mono text-[var(--text-dim)]">ID: {viewingTask.id}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewingTask(null)}
                className="w-8 h-8 p-0 text-[var(--text-dim)] hover:text-[var(--text-main)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs text-[var(--text-main)] leading-relaxed">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-[var(--border-main)]">
                <div>
                  <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase font-mono block">Recorrência</span>
                  <span className="font-bold text-[var(--accent)] font-mono">{viewingTask.recurrence || 'One-shot'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase font-mono block">Próxima Execução</span>
                  <span className="font-bold font-mono">{viewingTask.processAfter ? new Date(viewingTask.processAfter).toLocaleString('pt-BR') : 'Imediata'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase font-mono block mb-2">Texto Integral:</span>
                <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-main)] whitespace-pre-wrap font-mono text-xs leading-relaxed text-[var(--text-main)]">
                  {viewingTask.cleanPrompt || viewingTask.prompt}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--border-main)] bg-[var(--bg-card-subtle)] flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(viewingTask.cleanPrompt || viewingTask.prompt, 'view-copy')}
                className="gap-1.5 text-xs font-semibold"
              >
                {copiedId === 'view-copy' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'view-copy' ? 'Copiado!' : 'Copiar Texto'}</span>
              </Button>

              <Button variant="default" size="sm" onClick={() => setViewingTask(null)} className="text-xs font-bold">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW EXECUTION LOG MODAL */}
      {viewingLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs cursor-pointer animate-in fade-in"
          onClick={() => setViewingLog(null)}
        >
          <div
            className="w-full max-w-2xl bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] cursor-default animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-[var(--border-main)] bg-[var(--bg-card-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">Detalhes da Execução do Cron</h3>
                  <p className="text-xs font-mono text-[var(--text-dim)]">ID: {viewingLog.id}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewingLog(null)}
                className="w-8 h-8 p-0 text-[var(--text-dim)] hover:text-[var(--text-main)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs text-[var(--text-main)] leading-relaxed">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-[var(--border-main)]">
                <div>
                  <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase font-mono block">Data & Hora do Disparo</span>
                  <span className="font-bold font-mono text-[var(--text-main)]">{new Date(viewingLog.timestamp).toLocaleString('pt-BR')}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase font-mono block">Canal de Destino</span>
                  <span className="font-bold font-mono text-[var(--accent)]">{viewingLog.channelType}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-[var(--text-dim)] uppercase font-mono block mb-1">Instrução Disparada:</span>
                <div className="p-3.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-main)] whitespace-pre-wrap font-mono text-xs leading-relaxed text-[var(--text-main)]">
                  {viewingLog.cleanPrompt}
                </div>
              </div>

              {viewingLog.resultText && (
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase font-mono block mb-1 flex items-center gap-1">
                    <Send className="w-3.5 h-3.5" />
                    <span>Resultado Entregue / Mensagem de Auditoria:</span>
                  </span>
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-main)]">
                    {viewingLog.resultText}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--border-main)] bg-[var(--bg-card-subtle)] flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(viewingLog.resultText || viewingLog.cleanPrompt, 'log-copy')}
                className="gap-1.5 text-xs font-semibold"
              >
                {copiedId === 'log-copy' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'log-copy' ? 'Copiado!' : 'Copiar Resultado'}</span>
              </Button>

              <Button variant="default" size="sm" onClick={() => setViewingLog(null)} className="text-xs font-bold">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs cursor-pointer animate-in fade-in"
          onClick={() => setEditingTask(null)}
        >
          <div
            className="w-full max-w-2xl bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] cursor-default animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSaveEdit} className="flex flex-col h-full">
              {/* Header */}
              <div className="p-5 border-b border-[var(--border-main)] bg-[var(--bg-card-subtle)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20 flex items-center justify-center">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-main)]">Editar Rotina Recorrente</h3>
                    <p className="text-xs font-mono text-[var(--text-dim)]">ID: {editingTask.id}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="w-8 h-8 p-0 text-[var(--text-dim)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Form Body */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs">
                {/* Cron Expression */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5">
                    Expressão Cron (Recorrência)
                  </label>
                  <input
                    type="text"
                    required
                    value={editCron}
                    onChange={(e) => setEditCron(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs font-mono font-bold text-[var(--text-input)] focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    placeholder="0 * * * *"
                  />
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[10px] text-[var(--text-dim)] font-bold">Atalhos rápidos:</span>
                    <button
                      type="button"
                      onClick={() => setEditCron('0 * * * *')}
                      className="px-2 py-0.5 rounded bg-[var(--bg-input)] border border-[var(--border-main)] text-[10px] font-mono hover:border-sky-500 cursor-pointer"
                    >
                      A cada 1h (0 * * * *)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditCron('0 */2 * * *')}
                      className="px-2 py-0.5 rounded bg-[var(--bg-input)] border border-[var(--border-main)] text-[10px] font-mono hover:border-sky-500 cursor-pointer"
                    >
                      A cada 2h (0 */2 * * *)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditCron('0 */3 * * *')}
                      className="px-2 py-0.5 rounded bg-[var(--bg-input)] border border-[var(--border-main)] text-[10px] font-mono hover:border-sky-500 cursor-pointer"
                    >
                      A cada 3h (0 */3 * * *)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditCron('0 9 * * *')}
                      className="px-2 py-0.5 rounded bg-[var(--bg-input)] border border-[var(--border-main)] text-[10px] font-mono hover:border-sky-500 cursor-pointer"
                    >
                      Diário 09:00 UTC
                    </button>
                  </div>
                </div>

                {/* Prompt Textarea */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5">
                    Instrução / Prompt de Execução
                  </label>
                  <textarea
                    rows={6}
                    required
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    className="w-full p-3 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs leading-relaxed text-[var(--text-input)] focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono"
                    placeholder="Descreva detalhadamente o que o agente deve executar nesta rotina..."
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[var(--border-main)] bg-[var(--bg-card-subtle)] flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="text-xs font-semibold"
                >
                  Cancelar
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  type="submit"
                  disabled={isSaving}
                  className="gap-1.5 text-xs font-bold"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION ALERT DIALOG */}
      {deletingTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs cursor-pointer animate-in fade-in"
          onClick={() => setDeletingTask(null)}
        >
          <div
            className="w-full max-w-md bg-[var(--bg-card)] border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 cursor-default animate-in zoom-in-95 duration-150 text-[var(--text-main)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center mx-auto shadow-xs">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-[var(--text-main)]">Cancelar e Excluir Rotina?</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Você tem certeza que deseja cancelar a rotina <strong className="font-mono text-[var(--text-main)]">{deletingTask.id}</strong>? O sistema não executará mais este agendamento.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-main)] text-xs text-[var(--text-dim)] font-mono">
              <div className="text-[10px] font-bold uppercase text-[var(--text-dim)]">Periodicidade:</div>
              <div className="text-[var(--accent)] font-bold">{deletingTask.recurrence || 'One-shot'}</div>
              <div className="mt-1 text-[11px] line-clamp-2 text-[var(--text-muted)]">{deletingTask.cleanPrompt || deletingTask.prompt}</div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingTask(null)}
                disabled={isDeleting}
                className="text-xs font-semibold"
              >
                Manter Rotina
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="gap-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Excluindo...' : 'Sim, Excluir Rotina'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

