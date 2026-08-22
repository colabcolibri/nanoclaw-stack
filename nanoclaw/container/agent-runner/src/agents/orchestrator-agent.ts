import { AgentRegistry } from './registry.js';
import { WorkerAgentRunner } from './worker-agent.js';
import { SenderAgent } from './sender-agent.js';
import { AgentAuditLogger } from './audit-logger.js';
import { MemoService } from '../services/memo-service.js';
import { ToolRouter } from '../tools/router.js';
import type { MultiAgentTurnOptions, HandoverPackage } from './types.js';
import type { LLMCompletionFn, OrchestratorResult } from '../orchestrator/types.js';

export class OrchestratorAgent {
  /**
   * Orchestrates the hierarchical multi-agent turn:
   * 1. Triage & Department Reasoning
   * 2. Specialist Agent Selection inside the chosen Department
   * 3. Worker Execution with isolated agent-skills
   * 4. Quality Gate & Handover packaging
   * 5. Sender Agent Synthesis (Soul)
   */
  static async runTurn(
    complete: LLMCompletionFn,
    options: MultiAgentTurnOptions,
    temporalContext: string,
    onActivity?: () => void
  ): Promise<OrchestratorResult> {
    const prompt = options.prompt.trim();

    // 1. Fast-Path / Tool Need Detection
    // Check if the prompt can be directly answered without domain tools
    const routedTools = ToolRouter.selectTools(prompt);
    const isConversational = routedTools.length === 0;

    if (isConversational) {
      AgentAuditLogger.record(options.cwd, {
        step: 'orchestrator_triage',
        agent: 'orchestrator',
        purpose: 'Fast-path triage: pure conversation detected',
        latencyMs: 0,
        promptPreview: prompt.slice(0, 100),
        responsePreview: 'Direct route to Sender Agent',
        timestamp: new Date().toISOString(),
      });

      const handover: HandoverPackage = {
        userGoal: prompt,
        technicalFindings: '(No tools needed to be executed)',
        guidanceForSender: 'Responda diretamente na persona.',
        isFastPath: true,
      };

      const { deliveredText, rawContent } = await SenderAgent.deliver(
        handover,
        {
          prompt,
          chatJid: options.chatJid,
          cwd: options.cwd,
          history: options.history,
          personaInstructions: options.personaInstructions,
          coreMemory: options.coreMemory,
          temporalContext,
          senderModel: options.senderModel,
        },
        complete,
        onActivity
      );

      const memo = await MemoService.generateSemanticMemo(rawContent, async (sys, usr) => {
        const resp = await complete(
          [
            { role: 'system', content: sys },
            { role: 'user', content: usr },
          ],
          false,
          { purpose: 'semantic_memo' }
        );
        return resp.content || '';
      });

      const historyLimit = options.historyLimit || 10;
      const updatedHistory = [
        ...options.history,
        { role: 'user', content: prompt },
        { role: 'assistant', content: deliveredText },
      ].slice(-historyLimit);

      return {
        deliveredText,
        updatedHistory,
        toolsExecutedCount: 0,
        memo,
      };
    }

    // 2. Department Reasoning & Discovery
    // Identify the best Department for this user goal
    let selectedDeptId = 'productivity';
    const departments = AgentRegistry.getDepartments();

    // Keyword & domain matching heuristics first for fast resolution
    const normalizedPrompt = prompt.toLowerCase();
    for (const dept of departments) {
      if (dept.keywords.some((kw) => normalizedPrompt.includes(kw))) {
        selectedDeptId = dept.id;
        break;
      }
    }

    AgentAuditLogger.record(options.cwd, {
      step: 'department_routing',
      agent: 'orchestrator',
      department: selectedDeptId,
      purpose: `Identified department: ${selectedDeptId}`,
      latencyMs: 0,
      promptPreview: prompt.slice(0, 100),
      timestamp: new Date().toISOString(),
    });

    // 3. Specialist Agent Selection inside the Department
    const deptAgents = AgentRegistry.getAgentsInDepartment(selectedDeptId);
    let selectedAgent = deptAgents[0] || AgentRegistry.getAllAgents()[0];

    // Select the best agent inside the department based on keywords/skills
    for (const ag of deptAgents) {
      if (
        ag.agentSkills.some((s) => normalizedPrompt.includes(s.replace(/_/g, ' '))) ||
        ag.description.toLowerCase().split(' ').some((w) => w.length > 4 && normalizedPrompt.includes(w))
      ) {
        selectedAgent = ag;
        break;
      }
    }

    AgentAuditLogger.record(options.cwd, {
      step: 'agent_selection',
      agent: selectedAgent.id,
      department: selectedDeptId,
      purpose: `Selected specialist agent: ${selectedAgent.id} (${selectedAgent.name})`,
      latencyMs: 0,
      promptPreview: prompt.slice(0, 100),
      timestamp: new Date().toISOString(),
    });

    // 4. Worker Execution with isolated tools & skills
    const workerResult = await WorkerAgentRunner.execute(
      selectedAgent,
      prompt,
      complete,
      options.cwd,
      {
        maxIterations: options.maxWorkerIterations || 6,
        onActivity,
        history: options.history,
      }
    );

    // 5. Orchestrator Quality Gate & Handover Packaging
    const handover: HandoverPackage = {
      userGoal: prompt,
      technicalFindings: workerResult.rawFindingsReport,
      workerSummary: workerResult.summary,
      guidanceForSender: `O especialista [${selectedAgent.name}] concluiu a busca técnica. Sintetize as informações com clareza.`,
      isFastPath: false,
    };

    AgentAuditLogger.record(options.cwd, {
      step: 'orchestrator_evaluation',
      agent: 'orchestrator',
      purpose: `Quality gate passed. ${workerResult.findings.length} findings gathered by ${selectedAgent.id}.`,
      latencyMs: 0,
      responsePreview: workerResult.summary.slice(0, 100),
      timestamp: new Date().toISOString(),
    });

    // 6. Sender Agent Delivery (Soul Synthesis)
    const { deliveredText, rawContent } = await SenderAgent.deliver(
      handover,
      {
        prompt,
        chatJid: options.chatJid,
        cwd: options.cwd,
        history: options.history,
        personaInstructions: options.personaInstructions,
        coreMemory: options.coreMemory,
        temporalContext,
        senderModel: options.senderModel,
      },
      complete,
      onActivity
    );

    // 7. Semantic Memo & Trace
    const memo = await MemoService.generateSemanticMemo(rawContent, async (sys, usr) => {
      const resp = await complete(
        [
          { role: 'system', content: sys },
          { role: 'user', content: usr },
        ],
        false,
        { purpose: 'semantic_memo' }
      );
      return resp.content || '';
    });

    const historyLimit = options.historyLimit || 10;
    const updatedHistory = [
      ...options.history,
      { role: 'user', prompt },
      { role: 'assistant', content: deliveredText },
    ].slice(-historyLimit);

    return {
      deliveredText,
      updatedHistory,
      toolsExecutedCount: workerResult.findings.length,
      memo,
    };
  }
}
