import { executeTool } from '../tools/index.js';
import { BudgetLedger } from './budget-ledger.js';
import type { ToolBudgetDecision, WorkerExecutionProfile } from './types.js';

export interface TurnToolContext {
  agentId: string;
  profile: WorkerExecutionProfile;
  ledger: BudgetLedger;
  lastRefusal: ToolBudgetDecision | null;
}

export class ToolGateway {
  static createContext(agentId: string, profile: WorkerExecutionProfile): TurnToolContext {
    return {
      agentId,
      profile,
      ledger: new BudgetLedger(profile.toolBudgets),
      lastRefusal: null,
    };
  }

  static async execute(
    toolName: string,
    args: Record<string, unknown>,
    cwd: string,
    ctx: TurnToolContext,
  ): Promise<string> {
    const decision = ctx.ledger.evaluate(toolName, args);
    if (!decision.allowed) {
      ctx.lastRefusal = decision;
      return JSON.stringify({
        status: 'budget_refused',
        code: decision.code,
        tool: decision.tool,
        message: decision.reason,
      });
    }

    const result = await executeTool(toolName, args, cwd);
    ctx.ledger.record(toolName, args);
    return result;
  }
}
