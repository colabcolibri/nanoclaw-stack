import type { AgentAuditTraceItem, CronExecutionLog, IntermediateRunItem } from '@/api/client'

export type RunFilterKind =
  | 'all'
  | 'cron'
  | 'tools'
  | 'triage'
  | 'supervisor'
  | 'synthesis'
  | 'memo'
  | 'audit'

export type UnifiedRunKind =
  | 'cron'
  | 'tools'
  | 'triage'
  | 'supervisor'
  | 'synthesis'
  | 'memo'
  | 'audit'
  | 'model_turn'
  | 'fast'

export interface RunDetailRef {
  source: 'ledger' | 'audit' | 'cron'
  sourceDb: string
}

export interface UnifiedRun {
  id: string
  kind: UnifiedRunKind
  category: string
  timestamp: string
  status: string
  cron?: string
  channel?: string
  model?: string
  tokens?: number
  promptTokens?: number
  completionTokens?: number
  costUsd?: number
  costBrl?: number
  latencyMs?: number
  messageId?: string
  agent?: string
  department?: string
  supervisorStep?: number
  decision?: string
  prompt?: string
  output?: string
  auditMetadata?: Record<string, unknown>
  detailRef?: RunDetailRef
}

const AUDIT_STEP_LABELS: Record<string, string> = {
  orchestrator_triage: 'Triagem',
  orchestrator_supervisor: 'Supervisor (LLM)',
  supervisor_turn_start: 'Supervisor — início do turn',
  supervisor_delegate: 'Supervisor — delegação',
  supervisor_finish: 'Supervisor — finish',
  supervisor_turn_summary: 'Supervisor — resumo do turn',
  department_routing: 'Roteamento',
  agent_selection: 'Seleção de agente',
  worker_execution: 'Worker',
  orchestrator_evaluation: 'Pós-worker',
  sender_synthesis: 'Síntese sender',
  semantic_memo: 'Memo semântico',
}

function resolveDetailedRunKind(run: IntermediateRunItem): UnifiedRunKind {
  const isTool = run.hasToolCalls || (run.toolCallsCount && run.toolCallsCount > 0)

  if (run.purpose === 'semantic_memo') return 'memo'
  if (run.purpose === 'orchestrator_triage') return 'triage'
  if (run.purpose === 'orchestrator_supervisor') return 'supervisor'
  if (run.purpose === 'stage2_synthesis') return 'synthesis'
  if (run.purpose === 'fast_path_direct') return 'fast'
  if (isTool) return 'tools'
  return 'model_turn'
}

function normalizeCronLog(log: CronExecutionLog): UnifiedRun {
  return {
    id: log.id,
    kind: 'cron',
    category: 'Rotina Recorrente (Cron)',
    timestamp: log.timestamp,
    status: log.status || 'completed',
    cron: log.cron,
    channel: log.channelType || 'telegram',
    prompt: log.cleanPrompt || log.prompt,
    output: log.resultText,
    model: 'openai/gpt-oss-20b',
  }
}

function normalizeDetailedRun(run: IntermediateRunItem): UnifiedRun {
  const kind = resolveDetailedRunKind(run)

  return {
    id: run.id,
    kind,
    category: run.label || run.shortLabel || 'Execução de modelo',
    timestamp: run.timestamp,
    status: 'completed',
    model: run.model,
    tokens: run.totalTokens || (run.promptTokens || 0) + (run.completionTokens || 0),
    promptTokens: run.promptTokens,
    completionTokens: run.completionTokens,
    costUsd: run.costUsd,
    costBrl: run.costBrl,
    latencyMs: run.latencyMs,
    messageId: run.messageId,
    prompt: run.rawContent || run.preview || '',
    output: run.rawContent || run.preview || '',
  }
}

function normalizeAuditTrace(trace: AgentAuditTraceItem): UnifiedRun {
  const stepLabel = AUDIT_STEP_LABELS[trace.step] || trace.step

  return {
    id: trace.id,
    kind: 'audit',
    category: stepLabel,
    timestamp: trace.timestamp,
    status: 'completed',
    latencyMs: trace.latencyMs,
    messageId: trace.messageId,
    agent: trace.agent,
    department: trace.department,
    supervisorStep: trace.supervisorStep,
    decision: trace.decision,
    prompt: trace.promptPreview || trace.purpose,
    output: trace.responsePreview || (trace.metadata ? JSON.stringify(trace.metadata, null, 2) : ''),
    auditMetadata: trace.metadata,
  }
}

export function buildUnifiedRuns(
  cronLogs: CronExecutionLog[],
  detailedRuns: IntermediateRunItem[],
  auditTraces: AgentAuditTraceItem[],
): UnifiedRun[] {
  const list: UnifiedRun[] = [
    ...cronLogs.map(normalizeCronLog),
    ...detailedRuns.map(normalizeDetailedRun),
    ...auditTraces.map(normalizeAuditTrace),
  ]

  list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return list
}

export function matchesRunSearch(run: UnifiedRun, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  return (
    run.id?.toLowerCase().includes(q) ||
    run.prompt?.toLowerCase().includes(q) ||
    run.output?.toLowerCase().includes(q) ||
    run.category?.toLowerCase().includes(q)
  )
}

export function filterRunsByKind(runs: UnifiedRun[], kind: RunFilterKind): UnifiedRun[] {
  if (kind === 'all') return runs
  return runs.filter((run) => run.kind === kind)
}

export type RunKindCounts = Record<RunFilterKind, number>

export function countRunsByKind(runs: UnifiedRun[]): RunKindCounts {
  const counts: RunKindCounts = {
    all: runs.length,
    cron: 0,
    tools: 0,
    triage: 0,
    supervisor: 0,
    synthesis: 0,
    memo: 0,
    audit: 0,
  }

  for (const run of runs) {
    const key = run.kind
    if (key === 'cron' || key === 'tools' || key === 'triage' || key === 'supervisor' || key === 'synthesis' || key === 'memo' || key === 'audit') {
      counts[key] += 1
    }
  }

  return counts
}
