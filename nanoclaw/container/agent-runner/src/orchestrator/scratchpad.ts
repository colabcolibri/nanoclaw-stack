import { PayloadSanitizer } from './payload-sanitizer.js';
import { MemoService } from '../services/memo-service.js';
import { PromptLoader } from '../services/prompt-loader.js';

export interface ToolFinding {
  tool: string;
  args: Record<string, any>;
  result: string;
  timestamp: string;
}

/**
 * ExecutionScratchpad (SRP & Execution Memory):
 * Maintains the lean intermediate state throughout a turn's tool execution loops.
 * Isolates tool findings from bulky conversational history, preventing exponential context bloat.
 */
export class ExecutionScratchpad {
  readonly userGoal: string;
  private readonly contextExtracts: string[] = [];
  private readonly findings: ToolFinding[] = [];

  constructor(userPrompt: string, recentHistory: any[] = []) {
    this.userGoal = userPrompt.trim();

    // 1. Pull dense message memos with their real IDs (max 6 recent turns)
    const recentMemos = MemoService.getRecentMemos(6);
    if (recentMemos.length > 0) {
      for (const m of recentMemos) {
        if (m.memo && m.memo !== this.userGoal) {
          this.contextExtracts.push(`- [id: ${m.id} | ${m.role}]: "${m.memo}"`);
        }
      }
    } else if (recentHistory && recentHistory.length > 0) {
      // Fallback from passed history
      for (const h of recentHistory.slice(-4)) {
        if (h.content && typeof h.content === 'string') {
          const clean = MemoService.extractMemo(h.content);
          if (clean && clean !== this.userGoal) {
            this.contextExtracts.push(`- [${h.role}]: "${clean}"`);
          }
        }
      }
    }
  }

  /**
   * Records a sanitized tool finding into execution memory.
   */
  recordFinding(toolName: string, args: Record<string, any>, rawResult: string): void {
    const sanitized = PayloadSanitizer.sanitize(toolName, rawResult);
    this.findings.push({
      tool: toolName,
      args,
      result: sanitized,
      timestamp: new Date().toISOString(),
    });
  }

  hasFindings(): boolean {
    return this.findings.length > 0;
  }

  get findingsCount(): number {
    return this.findings.length;
  }

  /**
   * Generates a lean prompt for the next Stage 1 tool decision.
   * Feeds ONLY the user goal, dense memo index, and what has been discovered so far.
   */
  toStage1Messages(actionSystemPrompt: string): any[] {
    const messages: any[] = [{ role: 'system', content: actionSystemPrompt }];

    let contextSection = '';
    if (this.contextExtracts.length > 0) {
      contextSection = `## Recent Conversation Memos (Context Index):\n(To retrieve full uncompressed text of any past ID, execute \`retrieve_message_context\`)\n${this.contextExtracts.join('\n')}`;
    }

    let findingsSection = '';
    if (this.findings.length > 0) {
      const findingLines: string[] = ['## Gathered Tool Findings (Execution Memory):'];
      for (let i = 0; i < this.findings.length; i++) {
        const f = this.findings[i];
        findingLines.push(`[Step ${i + 1}] ${f.tool}(${JSON.stringify(f.args)}):\n${f.result}`);
      }
      findingLines.push('\nIf all necessary information has been gathered from tools, reply ONLY with "DONE". If more data is needed, invoke the next required tool.');
      findingsSection = findingLines.join('\n');
    }

    const content = PromptLoader.load('scratchpad.stage1.md', {
      USER_GOAL: this.userGoal,
      CONTEXT_MEMOS_SECTION: contextSection,
      FINDINGS_SECTION: findingsSection,
    }) || `## Active User Goal\n${this.userGoal}\n\n${contextSection}\n\n${findingsSection}`;

    messages.push({ role: 'user', content: content.trim() });
    return messages;
  }

  /**
   * Generates the structured findings report for the final Stage 2 Synthesis pass.
   */
  toSynthesisReport(): string {
    if (this.findings.length === 0) {
      return '(No tools needed to be executed)';
    }

    const lines: string[] = ['### Verified Execution Findings:'];
    for (let i = 0; i < this.findings.length; i++) {
      const f = this.findings[i];
      lines.push(`\n**[Source ${i + 1}: ${f.tool}]** (Parameters: \`${JSON.stringify(f.args)}\`)`);
      lines.push(`\`\`\`json\n${f.result}\n\`\`\``);
    }

    return lines.join('\n');
  }
}
