/**
 * Host-side LLM factory for /new-resume handoff summaries.
 * Uses the group's memo role model (same stack as orchestrator memo paths).
 */
import path from 'path';

import { resolveGroupRoleModels } from '../container-config.js';
import { DATA_DIR, GROUPS_DIR } from '../config.js';
import { getAgentGroup } from '../db/agent-groups.js';
import { createOpenAiCompatibleComplete } from '../gateway/llm-openai-compatible.js';
import { createLlmSummarizeFn } from './summarizer.js';
import type { SummarizeMessagesFn } from './types.js';

const PROJECT_ROOT = process.cwd();
const REGISTRY_PATH = path.join(DATA_DIR, 'llm-models.json');

export function buildConversationSummarizeFn(agentGroupId: string): SummarizeMessagesFn {
  const group = getAgentGroup(agentGroupId);
  if (!group?.folder) {
    throw new Error(`Grupo de agente não encontrado: ${agentGroupId}`);
  }

  const resolved = resolveGroupRoleModels(agentGroupId);
  if (!resolved?.memoModel) {
    throw new Error(
      'Não foi possível resolver o modelo memo do grupo — configure model, orchestrator, sender e memo em container config',
    );
  }

  const groupDir = path.join(GROUPS_DIR, group.folder);
  const summaryModel = resolved.memoModel;

  let completeFn: Awaited<ReturnType<typeof createOpenAiCompatibleComplete>> | null = null;
  return createLlmSummarizeFn(async (messages) => {
    if (!completeFn) {
      completeFn = await createOpenAiCompatibleComplete({
        groupDir,
        registryPath: REGISTRY_PATH,
        projectRoot: PROJECT_ROOT,
        defaultModel: summaryModel,
        messageId: `summarize-${Date.now()}`,
        recordTelemetry: false,
      });
    }
    return completeFn(messages);
  });
}
