import fs from 'fs';
import path from 'path';
import { resolveContainerRoleModels } from './role-models.js';
import { parseRoleInferenceOverrides, type RoleInferenceOverrides } from './inference-resolver.js';

export interface ContainerRoleConfig {
  providerId?: string;
  workerModel?: string;
  orchestratorModel?: string;
  senderModel?: string;
  memoModel?: string;
  roleInferenceOverrides: RoleInferenceOverrides;
}

/**
 * Carrega e resolve os modelos por papel a partir do container.json do grupo.
 * Isolado do provider para manter SRP — qualquer runtime pode reusar.
 *
 * Retorna defaults vazios quando nenhum container.json existe ou é ilegível.
 */
export function loadContainerRoleConfig(
  cwd: string,
  fallbackProviderId?: string,
): ContainerRoleConfig {
  const candidates = [
    path.join(cwd, 'container.json'),
    '/workspace/agent/container.json',
    '/workspace/group/container.json',
  ];

  for (const cfgPath of candidates) {
    try {
      if (!fs.existsSync(cfgPath)) continue;
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      const providerId = cfg.provider || fallbackProviderId;
      const resolved = resolveContainerRoleModels(
        providerId,
        {
          model: cfg.model,
          orchestratorModel: cfg.orchestratorModel,
          senderModel: cfg.senderModel,
          memoModel: cfg.memoModel,
        },
        cwd,
      );

      return {
        providerId,
        workerModel: resolved?.model ?? cfg.model,
        orchestratorModel: resolved?.orchestratorModel ?? cfg.orchestratorModel,
        senderModel: resolved?.senderModel ?? cfg.senderModel,
        memoModel: resolved?.memoModel ?? cfg.memoModel,
        roleInferenceOverrides: parseRoleInferenceOverrides(cfg.roleInferenceParams),
      };
    } catch {}
  }

  return { roleInferenceOverrides: {} };
}
