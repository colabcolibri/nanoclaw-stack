import type { WorkerResult } from '../agents/types.js';
import type { CapabilityRecord } from '../execution/supervisor-policy.js';

export interface TurnStepRecord {
  stepIndex: number;
  agentId: string;
  agentName: string;
  departmentId: string;
  taskDescription: string;
  workerResult: WorkerResult;
  completedAt: string;
}

/**
 * Accumulates specialist results within a single user turn.
 * SRP: only stores and formats supervisor/worker state — no LLM calls.
 */
export class TurnPlanState {
  readonly userGoal: string;
  readonly steps: TurnStepRecord[] = [];
  readonly capabilityRecords: CapabilityRecord[] = [];

  constructor(userGoal: string) {
    this.userGoal = userGoal.trim();
  }

  appendStep(record: Omit<TurnStepRecord, 'stepIndex' | 'completedAt'>): TurnStepRecord {
    const entry: TurnStepRecord = {
      ...record,
      stepIndex: this.steps.length + 1,
      completedAt: new Date().toISOString(),
    };
    this.steps.push(entry);
    this.capabilityRecords.push({
      agentId: record.agentId,
      capability: record.workerResult.completion.capability,
      completion: record.workerResult.completion,
    });
    return entry;
  }

  get totalFindings(): number {
    return this.steps.reduce((sum, s) => sum + s.workerResult.findings.length, 0);
  }

  /** Compact context for the supervisor LLM between delegations. */
  formatForSupervisor(): string {
    if (this.steps.length === 0) {
      return '(No specialist steps completed yet.)';
    }

    const lines: string[] = [];
    for (const step of this.steps) {
      lines.push(
        `### Step ${step.stepIndex}: ${step.agentName} (${step.agentId})`,
        `Task: ${step.taskDescription}`,
        `Summary: ${step.workerResult.summary || '(no summary)'}`,
        `Findings: ${step.workerResult.findings.length} tool result(s)`,
      );

      if (step.workerResult.findings.length > 0) {
        for (const finding of step.workerResult.findings) {
          lines.push(`- **${finding.tool}**: ${finding.result.slice(0, 1200)}`);
        }
      } else if (step.workerResult.rawFindingsReport) {
        lines.push(step.workerResult.rawFindingsReport.slice(0, 2000));
      }

      lines.push('');
    }
    return lines.join('\n').trim();
  }

  /** Prior-step context injected into the next worker task. */
  formatPriorStepsForWorker(): string {
    if (this.steps.length === 0) return '';

    const lines: string[] = [];
    for (const step of this.steps) {
      lines.push(
        `[Step ${step.stepIndex} — ${step.agentId}] ${step.taskDescription}`,
        `Result: ${step.workerResult.summary || '(done)'}`,
      );
      if (step.workerResult.findings.length > 0) {
        const last = step.workerResult.findings[step.workerResult.findings.length - 1];
        lines.push(`Last tool (${last.tool}): ${last.result.slice(0, 800)}`);
      }
      lines.push('');
    }
    return lines.join('\n').trim();
  }

  buildTechnicalFindings(): string {
    if (this.steps.length === 0) {
      return '(No tools were executed by specialists.)';
    }

    const blocks = this.steps.map(
      (step) =>
        `### Specialist: ${step.agentName} (${step.agentId})\n` +
        `Task: ${step.taskDescription}\n\n` +
        `${step.workerResult.rawFindingsReport || step.workerResult.summary}`
    );
    return blocks.join('\n\n');
  }

  buildWorkerSummaryLine(): string {
    if (this.steps.length === 0) return '';
    return this.steps.map((s) => `[${s.agentId}] ${s.workerResult.summary}`).join(' | ');
  }

  /** Snapshot estruturado para agent_audit.jsonl (replay do turn). */
  toAuditMetadata(): Record<string, unknown> {
    return {
      userGoal: this.userGoal,
      stepCount: this.steps.length,
      totalFindings: this.totalFindings,
      steps: this.steps.map((s) => ({
        stepIndex: s.stepIndex,
        agentId: s.agentId,
        agentName: s.agentName,
        departmentId: s.departmentId,
        taskDescription: s.taskDescription.slice(0, 500),
        summary: s.workerResult.summary,
        findingsCount: s.workerResult.findings.length,
        tools: [...new Set(s.workerResult.findings.map((f) => f.tool))],
        completedAt: s.completedAt,
      })),
    };
  }
}
