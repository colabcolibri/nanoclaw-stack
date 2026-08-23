/**
 * Resolução centralizada de inference params por chamada LLM.
 * Camadas (última vence): catálogo (provider + modelo) → override por papel (container) → override por purpose → override da chamada.
 */
import { mergeInferenceParams, type InferenceParams } from '../inference-params.js';
import type { LlmCallPurpose } from './llm-call-purpose.js';
import type { LlmRole } from './role-models.js';
import { ModelRegistry } from './model-registry.js';

export interface RoleInferenceOverrides {
  orchestrator?: InferenceParams;
  worker?: InferenceParams;
  sender?: InferenceParams;
  memo?: InferenceParams;
}

const PURPOSE_CALL_OVERRIDES: Partial<Record<Exclude<LlmCallPurpose, 'unknown'>, InferenceParams>> = {
  semantic_memo: { maxTokens: 256, temperature: 0.2 },
};

export function purposeToLlmRole(purpose: string | undefined | null): LlmRole {
  switch (purpose) {
    case 'semantic_memo':
      return 'memo';
    case 'orchestrator_triage':
    case 'orchestrator_supervisor':
      return 'orchestrator';
    case 'stage2_synthesis':
    case 'fast_path_direct':
      return 'sender';
    default:
      return 'worker';
  }
}

function parseInferenceField(parsed: Record<string, unknown>, key: keyof InferenceParams, out: InferenceParams): void {
  const value = parsed[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    out[key] = value;
  }
}

function parseInferenceParamsObject(raw: unknown): InferenceParams | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const parsed = raw as Record<string, unknown>;
  const out: InferenceParams = {};
  parseInferenceField(parsed, 'temperature', out);
  parseInferenceField(parsed, 'maxTokens', out);
  parseInferenceField(parsed, 'topP', out);
  parseInferenceField(parsed, 'topK', out);
  parseInferenceField(parsed, 'frequencyPenalty', out);
  parseInferenceField(parsed, 'presencePenalty', out);
  return Object.keys(out).length > 0 ? out : undefined;
}

export function parseRoleInferenceOverridesJson(raw: string | null | undefined): RoleInferenceOverrides {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: RoleInferenceOverrides = {};
    for (const role of ['orchestrator', 'worker', 'sender', 'memo'] as const) {
      const params = parseInferenceParamsObject(parsed[role]);
      if (params) out[role] = params;
    }
    return out;
  } catch {
    return {};
  }
}

export function parseRoleInferenceOverrides(raw: unknown): RoleInferenceOverrides {
  if (typeof raw === 'string') return parseRoleInferenceOverridesJson(raw);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: RoleInferenceOverrides = {};
  const obj = raw as Record<string, unknown>;
  for (const role of ['orchestrator', 'worker', 'sender', 'memo'] as const) {
    const params = parseInferenceParamsObject(obj[role]);
    if (params) out[role] = params;
  }
  return out;
}

export interface ResolveCallInferenceParamsInput {
  modelId: string;
  role?: LlmRole;
  purpose?: string | null;
  roleOverrides?: RoleInferenceOverrides;
  callOverride?: InferenceParams;
  cwd?: string;
}

export function resolveCallInferenceParams(input: ResolveCallInferenceParamsInput): InferenceParams {
  const role = input.role ?? purposeToLlmRole(input.purpose);
  const catalogParams = ModelRegistry.requireInvocation(input.modelId, input.cwd).params;
  const roleParams = input.roleOverrides?.[role] ?? {};
  const purposeKey = input.purpose;
  const purposeParams =
    purposeKey && purposeKey in PURPOSE_CALL_OVERRIDES
      ? (PURPOSE_CALL_OVERRIDES[purposeKey as Exclude<LlmCallPurpose, 'unknown'>] ?? {})
      : {};
  return mergeInferenceParams(
    mergeInferenceParams(mergeInferenceParams(catalogParams, purposeParams), roleParams),
    input.callOverride ?? {},
  );
}
