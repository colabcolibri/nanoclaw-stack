import {
  formatPurposeLabel,
  getPurposeMeta,
  parseToolNameFromPreview,
  resolvePurpose,
} from "../../../../nanoclaw/container/agent-runner/src/services/llm-call-purpose.js";
import type { RunFilterKind, RunIndexKind, RunSource } from "./types.js";

const AUDIT_STEP_LABELS: Record<string, string> = {
  orchestrator_triage: "Triagem",
  orchestrator_supervisor: "Supervisor (LLM)",
  supervisor_turn_start: "Supervisor — início do turn",
  supervisor_delegate: "Supervisor — delegação",
  supervisor_finish: "Supervisor — finish",
  supervisor_turn_summary: "Supervisor — resumo do turn",
  department_routing: "Roteamento",
  agent_selection: "Seleção de agente",
  worker_execution: "Worker",
  orchestrator_evaluation: "Pós-worker",
  sender_synthesis: "Síntese sender",
  semantic_memo: "Memo semântico",
};

export function auditStepLabel(step: string): string {
  return AUDIT_STEP_LABELS[step] || step;
}

export function resolveLedgerKind(input: {
  purpose?: string | null;
  preview?: string | null;
  hasToolCalls?: boolean;
  toolCallsCount?: number;
}): RunIndexKind {
  const purpose = resolvePurpose(input);
  return getPurposeMeta(purpose).runsFilterKind as RunIndexKind;
}

export function resolveLedgerCategory(input: {
  purpose?: string | null;
  preview?: string | null;
  hasToolCalls?: boolean;
  toolCallsCount?: number;
}): string {
  const purpose = resolvePurpose(input);
  const meta = getPurposeMeta(purpose);
  const toolName = parseToolNameFromPreview(input.preview ?? undefined);
  return formatPurposeLabel(purpose, { toolName: toolName || undefined });
}

export function buildSearchText(parts: Array<string | null | undefined>): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .slice(0, 512);
}

export function emptyKindCounts(): Record<RunFilterKind, number> {
  return {
    all: 0,
    cron: 0,
    tools: 0,
    triage: 0,
    supervisor: 0,
    synthesis: 0,
    memo: 0,
    audit: 0,
  };
}

export function incrementKindCount(
  counts: Record<RunFilterKind, number>,
  kind: RunIndexKind,
): void {
  if (kind === "model_turn" || kind === "fast") return;
  counts[kind as Exclude<RunFilterKind, "all">] += 1;
}

export function sourceLabel(source: RunSource): string {
  switch (source) {
    case "ledger":
      return "ledger";
    case "audit":
      return "audit";
    case "cron":
      return "cron";
  }
}
