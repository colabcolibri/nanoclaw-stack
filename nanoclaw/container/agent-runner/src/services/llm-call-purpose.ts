/**
 * Catálogo único de purposes de chamadas LLM — labels, prefixos de preview e tipo de UI.
 * Runtime (agent-runner) e painel (ui) devem usar este módulo.
 */

export type LlmCallPurpose =
  | 'stage1_action'
  | 'stage2_synthesis'
  | 'semantic_memo'
  | 'fast_path_direct'
  | 'orchestrator_triage'
  | 'skill_evaluation'
  | 'system_diagnostics'
  | 'unknown';

export interface LlmCallPurposeMeta {
  purpose: LlmCallPurpose;
  /** Label principal na auditoria / runs */
  label: string;
  /** Label curta para badges */
  shortLabel: string;
  previewPrefix: string;
  uiType:
    | 'tool_execution'
    | 'memo_generation'
    | 'orchestrator_triage'
    | 'persona_synthesis'
    | 'fast_path'
    | 'model_turn';
  runsFilterKind: 'tools' | 'memo' | 'triage' | 'synthesis' | 'fast' | 'model_turn';
}

const PURPOSE_CATALOG: Record<Exclude<LlmCallPurpose, 'unknown'>, LlmCallPurposeMeta> = {
  orchestrator_triage: {
    purpose: 'orchestrator_triage',
    label: 'Triagem do orquestrador',
    shortLabel: 'Triagem',
    previewPrefix: 'Triagem: ',
    uiType: 'orchestrator_triage',
    runsFilterKind: 'triage',
  },
  fast_path_direct: {
    purpose: 'fast_path_direct',
    label: 'Resposta direta (sender)',
    shortLabel: 'Conversa',
    previewPrefix: 'Conversa: ',
    uiType: 'fast_path',
    runsFilterKind: 'fast',
  },
  stage2_synthesis: {
    purpose: 'stage2_synthesis',
    label: 'Síntese persona (sender)',
    shortLabel: 'Síntese',
    previewPrefix: 'Síntese: ',
    uiType: 'persona_synthesis',
    runsFilterKind: 'synthesis',
  },
  stage1_action: {
    purpose: 'stage1_action',
    label: 'Ação & ferramentas (worker)',
    shortLabel: 'Ferramentas',
    previewPrefix: 'Ação: ',
    uiType: 'tool_execution',
    runsFilterKind: 'tools',
  },
  semantic_memo: {
    purpose: 'semantic_memo',
    label: 'Memo semântico',
    shortLabel: 'Memo',
    previewPrefix: 'Memo: ',
    uiType: 'memo_generation',
    runsFilterKind: 'memo',
  },
  skill_evaluation: {
    purpose: 'skill_evaluation',
    label: 'Avaliação de skill',
    shortLabel: 'Skill',
    previewPrefix: 'Skill: ',
    uiType: 'model_turn',
    runsFilterKind: 'model_turn',
  },
  system_diagnostics: {
    purpose: 'system_diagnostics',
    label: 'Diagnóstico de sistema',
    shortLabel: 'Diagnóstico',
    previewPrefix: 'Diag: ',
    uiType: 'model_turn',
    runsFilterKind: 'model_turn',
  },
};

const UNKNOWN_META: LlmCallPurposeMeta = {
  purpose: 'unknown',
  label: 'Execução de modelo',
  shortLabel: 'Modelo',
  previewPrefix: '',
  uiType: 'model_turn',
  runsFilterKind: 'model_turn',
};

const PREVIEW_PREFIX_ORDER: Array<{ prefix: string; purpose: Exclude<LlmCallPurpose, 'unknown'> }> = [
  { prefix: 'Triagem: ', purpose: 'orchestrator_triage' },
  { prefix: 'Conversa: ', purpose: 'fast_path_direct' },
  { prefix: 'Síntese: ', purpose: 'stage2_synthesis' },
  { prefix: 'Memo: ', purpose: 'semantic_memo' },
  { prefix: 'memo: ', purpose: 'semantic_memo' },
  { prefix: 'Ação: ', purpose: 'stage1_action' },
  { prefix: 'Skill: ', purpose: 'skill_evaluation' },
  { prefix: 'Diag: ', purpose: 'system_diagnostics' },
];

export function isKnownPurpose(value: string | undefined | null): value is Exclude<LlmCallPurpose, 'unknown'> {
  return Boolean(value && value in PURPOSE_CATALOG);
}

export function getPurposeMeta(purpose: string | undefined | null): LlmCallPurposeMeta {
  if (isKnownPurpose(purpose)) return PURPOSE_CATALOG[purpose];
  return UNKNOWN_META;
}

export function inferPurposeFromPreview(preview?: string | null): LlmCallPurpose | null {
  if (!preview) return null;
  if (preview.startsWith('Tool: ') || preview.startsWith('Tool [')) return 'stage1_action';
  for (const entry of PREVIEW_PREFIX_ORDER) {
    if (preview.startsWith(entry.prefix)) return entry.purpose;
  }
  return null;
}

export function resolvePurpose(input: {
  purpose?: string | null;
  preview?: string | null;
  hasToolCalls?: boolean;
  toolCallsCount?: number;
}): LlmCallPurpose {
  if (isKnownPurpose(input.purpose)) return input.purpose;
  const fromPreview = inferPurposeFromPreview(input.preview);
  if (fromPreview) return fromPreview;
  if (input.hasToolCalls || (input.toolCallsCount && input.toolCallsCount > 0)) return 'stage1_action';
  return 'unknown';
}

export function parseToolNameFromPreview(preview?: string | null): string {
  if (!preview) return '';
  if (preview.startsWith('Tool: ')) return preview.replace('Tool: ', '').trim();
  if (preview.startsWith('Tool [')) {
    const endIdx = preview.indexOf(']:');
    if (endIdx !== -1) return preview.slice(6, endIdx).trim();
  }
  return '';
}

export function buildLedgerPreview(
  purpose: string | undefined | null,
  content?: string | null,
  toolCalls?: Array<{ function?: { name?: string } }> | null,
): string {
  const resolved = resolvePurpose({ purpose, hasToolCalls: Boolean(toolCalls?.length) });
  const meta = getPurposeMeta(resolved);

  if (toolCalls?.length) {
    const names = toolCalls.map((tc) => tc.function?.name).filter(Boolean).join(', ');
    return content ? `Tool [${names}]: ${content}` : `Tool: ${toolCalls[0]?.function?.name || 'ferramenta'}`;
  }

  if (!content) return '';
  return meta.previewPrefix ? `${meta.previewPrefix}${content}` : content;
}

export function formatPurposeLabel(
  purpose: string | undefined | null,
  opts?: { toolName?: string; short?: boolean },
): string {
  const meta = getPurposeMeta(resolvePurpose({ purpose, preview: undefined }));
  if (opts?.short) return meta.shortLabel;
  if (meta.purpose === 'stage1_action' && opts?.toolName) {
    return `Ferramenta: ${opts.toolName}`;
  }
  return meta.label;
}
