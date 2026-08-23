/**
 * Bun-only orchestrator worker — LLM + tools via agent-runner.
 * Must NOT import host modules that use better-sqlite3 (central v2.db).
 */
import path from 'path';

import { createOpenAiCompatibleComplete } from './llm-openai-compatible.js';
import type { OrchestratorTurnRequest, OrchestratorTurnResult } from './sync-turn-types.js';

export async function runOrchestratorTurn(request: OrchestratorTurnRequest): Promise<OrchestratorTurnResult> {
  const containerSrc = path.join(request.projectRoot, 'container', 'agent-runner', 'src');

  const completeFn = await createOpenAiCompatibleComplete({
    groupDir: request.groupDir,
    registryPath: request.registryPath,
    projectRoot: request.projectRoot,
    defaultModel: request.defaultModel,
    messageId: request.userMsgId,
    recordTelemetry: true,
  });

  const { TurnOrchestrator } = await import(path.join(containerSrc, 'orchestrator', 'turn-orchestrator.ts'));

  const turnResult = await TurnOrchestrator.runTurn(completeFn, {
    prompt: request.prompt,
    cwd: request.groupDir,
    chatJid: request.threadId,
    history: request.history,
    systemInstructions: request.systemInstructions,
    personaInstructions: request.personaInstructions,
    coreMemory: request.coreMemory,
    historyLimit: 30,
    orchestratorModel: request.orchestratorModel,
    senderModel: request.senderModel,
    defaultModel: request.defaultModel,
  });

  return {
    deliveredText: turnResult.deliveredText,
    toolsExecutedCount: turnResult.toolsExecutedCount,
  };
}
