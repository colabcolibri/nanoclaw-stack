/**
 * Resolução de modelos por papel (orchestrator / worker / sender).
 * Regra: vazio = padrão do catálogo para o provider do grupo; valor explícito = override.
 * Worker: modelo do grupo (container.json `model`) vale para todos os specialists;
 * `agent.model` no AGENT.md só quando o usuário define override no painel.
 */

import fs from 'fs';
import path from 'path';

export type LlmRole = 'orchestrator' | 'worker' | 'sender';

export interface RoleModelRegistryProvider {
  defaultModel: string;
  models: Array<{
    id: string;
    recommended?: boolean;
    recommendedRole?: string;
  }>;
}

export interface RoleModelRegistry {
  providers: Record<string, RoleModelRegistryProvider>;
  modelsById: Record<string, { providerId: string }>;
}

export interface RoleModelOverrides {
  model?: string | null;
  orchestratorModel?: string | null;
  senderModel?: string | null;
}

export interface ResolvedRoleModels {
  model: string;
  orchestratorModel: string;
  senderModel: string;
}

const ROLE_FIELDS: Record<keyof ResolvedRoleModels, LlmRole> = {
  model: 'worker',
  orchestratorModel: 'orchestrator',
  senderModel: 'sender',
};

export function pickDefaultModelForRole(
  providerId: string,
  role: LlmRole,
  registry: RoleModelRegistry,
): string | undefined {
  const provider = registry.providers[providerId.toLowerCase()];
  if (!provider) return undefined;

  const byRole =
    provider.models.find((m) => m.recommendedRole === role && m.recommended) ??
    provider.models.find((m) => m.recommendedRole === role) ??
    provider.models.find((m) => m.recommendedRole === 'all' && m.recommended) ??
    provider.models.find((m) => m.recommendedRole === 'all');

  return byRole?.id ?? provider.defaultModel;
}

export function resolveRoleModelForProvider(
  providerId: string,
  role: LlmRole,
  explicit: string | null | undefined,
  registry: RoleModelRegistry,
): string | undefined {
  const pid = providerId.toLowerCase();
  const trimmed = explicit?.trim();

  if (trimmed) {
    const meta = registry.modelsById[trimmed];
    if (meta?.providerId === pid) return trimmed;
  }

  return pickDefaultModelForRole(pid, role, registry);
}

export function resolveRoleModels(
  providerId: string,
  registry: RoleModelRegistry,
  overrides: RoleModelOverrides,
): ResolvedRoleModels | null {
  const pid = providerId?.trim().toLowerCase();
  if (!pid || !registry.providers[pid]) return null;

  const model = resolveRoleModelForProvider(pid, 'worker', overrides.model, registry);
  const orchestratorModel = resolveRoleModelForProvider(pid, 'orchestrator', overrides.orchestratorModel, registry);
  const senderModel = resolveRoleModelForProvider(pid, 'sender', overrides.senderModel, registry);

  if (!model || !orchestratorModel || !senderModel) return null;

  return { model, orchestratorModel, senderModel };
}

/** Modelo do worker: grupo primeiro; override por agente só se definido no AGENT.md. */
export function resolveWorkerModel(
  groupWorkerModel: string | undefined,
  agentModel?: string | null,
): string | undefined {
  const group = groupWorkerModel?.trim();
  const agent = agentModel?.trim();
  if (agent) return agent;
  return group || undefined;
}

export function roleFieldToLlmRole(field: keyof ResolvedRoleModels): LlmRole {
  return ROLE_FIELDS[field];
}

function registryFileCandidates(cwd?: string): string[] {
  const candidates: string[] = [];
  if (cwd) {
    candidates.push(cwd.endsWith('.json') ? cwd : path.join(cwd, 'llm-models.json'));
  }
  const nanoclawPath = process.env.NANOCLAW_DATA_DIR?.trim();
  if (nanoclawPath) {
    candidates.push(path.join(nanoclawPath, 'llm-models.json'));
  }
  candidates.push(
    '/workspace/agent/llm-models.json',
    path.join(process.cwd(), 'llm-models.json'),
    path.join(process.cwd(), 'data', 'llm-models.json'),
  );
  return candidates;
}

export function readRoleModelRegistry(cwd?: string): RoleModelRegistry | null {
  for (const filePath of registryFileCandidates(cwd)) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RoleModelRegistry;
      if (raw.providers && raw.modelsById) return raw;
    } catch {
      // try next candidate
    }
  }
  return null;
}

export function resolveContainerRoleModels(
  providerId: string | undefined,
  overrides: RoleModelOverrides,
  cwd?: string,
): ResolvedRoleModels | null {
  const pid = providerId?.trim();
  if (!pid) return null;
  const registry = readRoleModelRegistry(cwd);
  if (!registry) return null;
  return resolveRoleModels(pid, registry, overrides);
}
