import { AgentRegistry } from './registry.js';
import { executeTool } from '../tools/index.js';
import { ExecutionScratchpad } from '../orchestrator/scratchpad.js';
import { ResponseParser } from '../orchestrator/parser.js';
import { AgentAuditLogger } from './audit-logger.js';
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
    } = {}
  ): Promise<WorkerResult> {
    const maxIterations = Math.max(1, options.maxIterations || 6);
    const tools = AgentRegistry.getToolsForAgent(agent.id);
    const scratchpad = new ExecutionScratchpad(taskDescription, options.history || []);
    const findings: ToolFinding[] = [];

    const systemPrompt = [
      agent.systemPrompt,
      '## Diretriz Técnica de Execução',
      'Execute as ferramentas com precisão máxima.',
      'Quando tiver coletado todas as informações ou completado a ação, responda apenas com "DONE" ou um breve resumo dos dados.',
    ].join('\n\n');

    let iterationsRun = 0;
    let finalSummary = '';

    for (let iter = 0; iter < maxIterations; iter++) {
      options.onActivity?.();
      iterationsRun++;

      const currentMessages = scratchpad.toStage1Messages(systemPrompt);
      const startTime = Date.now();

      const response = await complete(currentMessages, tools, {
        purpose: 'stage1_action',
        agent: agent.id,
        department: agent.departmentId,
        iteration: iter + 1,
      });

      const latencyMs = Date.now() - startTime;
      const toolCalls = ResponseParser.extractToolCalls(response);

      AgentAuditLogger.record(cwd, {
        step: 'worker_execution',
        agent: agent.id,
        department: agent.departmentId,
        purpose: `Worker iteration ${iter + 1}`,
        latencyMs,
        promptPreview: taskDescription.slice(0, 100),
        responsePreview: response.content ? response.content.slice(0, 100) : `Tool: ${toolCalls[0]?.name}`,
        timestamp: new Date().toISOString(),
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
