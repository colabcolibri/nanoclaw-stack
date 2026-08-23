import { AgentRegistry } from './registry.js';
import { executeTool } from '../tools/index.js';
import { ExecutionScratchpad } from '../orchestrator/scratchpad.js';
import { ResponseParser } from '../orchestrator/parser.js';
import { AgentAuditLogger } from './audit-logger.js';
import { ModelRegistry } from '../services/model-registry.js';
import { PromptLoader } from '../services/prompt-loader.js';
import { resolveWorkerModel } from '../services/role-models.js';
import type { SpecialistAgent, WorkerResult, ToolFinding } from './types.js';
import type { LLMCompletionFn } from '../orchestrator/types.js';

export class WorkerAgentRunner {
  /**
   * Executes a specialist worker agent within an isolated sandbox.
   * Only the specialist's assigned skills (+ global skills) are loaded.
   */
  static async execute(
    agent: SpecialistAgent,
    taskDescription: string,
    complete: LLMCompletionFn,
    cwd: string,
    options: {
      maxIterations?: number;
      onActivity?: () => void;
      history?: any[];
      defaultModel?: string;
      messageId?: string;
      supervisorStep?: number;
    } = {}
  ): Promise<WorkerResult> {
    const maxIterations = Math.max(1, options.maxIterations || 6);
    const tools = AgentRegistry.getToolsForAgent(agent.id, cwd);
    const resolvedToolNames = tools.map((t) => t.function.name);
    const scratchpad = new ExecutionScratchpad(taskDescription, options.history || []);
    const findings: ToolFinding[] = [];

    const systemPrompt = [
      agent.systemPrompt,
      PromptLoader.load('core.truthfulness'),
      PromptLoader.load('worker.execution'),
    ]
      .filter(Boolean)
      .join('\n\n');

    let iterationsRun = 0;
    let finalSummary = '';

    for (let iter = 0; iter < maxIterations; iter++) {
      options.onActivity?.();
      iterationsRun++;

      const currentMessages = scratchpad.toStage1Messages(systemPrompt);
      const startTime = Date.now();

      const resolvedModel = ModelRegistry.requireModelId(
        resolveWorkerModel(options.defaultModel, agent.model),
        'model',
        cwd,
      );

      const response = await complete(currentMessages, tools, {
        purpose: 'stage1_action',
        agent: agent.id,
        department: agent.departmentId,
        iteration: iter + 1,
        model: resolvedModel,
        messageId: options.messageId,
        supervisorStep: options.supervisorStep,
      });

      const latencyMs = Date.now() - startTime;
      const toolCalls = ResponseParser.extractToolCalls(response);

      AgentAuditLogger.recordStep(cwd, {
        step: 'worker_execution',
        agent: agent.id,
        department: agent.departmentId,
        messageId: options.messageId,
        supervisorStep: options.supervisorStep,
        purpose: `Worker iteration ${iter + 1}${options.supervisorStep ? ` (supervisor step ${options.supervisorStep})` : ''}`,
        latencyMs,
        promptPreview: taskDescription.slice(0, 100),
        responsePreview: response.content ? response.content.slice(0, 100) : `Tool: ${toolCalls[0]?.name}`,
        metadata: toolCalls.length
          ? {
              tools: toolCalls.map((c) => c.name),
              iteration: iter + 1,
              resolvedTools: iter === 0 ? resolvedToolNames : undefined,
            }
          : { iteration: iter + 1, done: true, resolvedTools: iter === 0 ? resolvedToolNames : undefined },
      });

      if (toolCalls.length > 0) {
        for (const call of toolCalls) {
          options.onActivity?.();
          const toolResult = await executeTool(call.name, call.args, cwd);

          scratchpad.recordFinding(call.name, call.args, toolResult);
          findings.push({
            tool: call.name,
            args: call.args,
            result: toolResult,
            timestamp: new Date().toISOString(),
          });
        }
        continue;
      }

      // No more tools called; worker has finished its work
      finalSummary = ResponseParser.cleanHumanText(response.content) || 'Processamento técnico concluído.';
      break;
    }

    return {
      agentId: agent.id,
      status: findings.length > 0 || finalSummary ? 'success' : 'partial',
      findings,
      summary: finalSummary,
      rawFindingsReport: scratchpad.toSynthesisReport(),
      iterations: iterationsRun,
    };
  }
}
