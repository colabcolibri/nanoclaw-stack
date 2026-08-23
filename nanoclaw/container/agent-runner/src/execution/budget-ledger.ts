import type { ToolBudgetDecision, ToolBudgetRule, ToolDedupeKey } from './types.js';

function normalizeToolName(name: string): string {
  const n = name.toLowerCase().replace(/-/g, '_');
  return n === 'web_research' ? 'web_search' : n;
}

function dedupeValue(tool: string, args: Record<string, unknown>, key: ToolDedupeKey): string {
  switch (key) {
    case 'query':
      return String(args.query ?? args.q ?? '').trim().toLowerCase();
    case 'url':
      return String(args.url ?? args.href ?? '').trim().toLowerCase();
    case 'args_hash':
      return JSON.stringify(args);
    default:
      return JSON.stringify(args);
  }
}

/**
 * Per-turn tool budget ledger. Enforces declarative limits from worker profiles.
 * Single responsibility: count + dedupe — no tool-specific logic.
 */
export class BudgetLedger {
  private readonly callCounts = new Map<string, number>();
  private readonly dedupeSets = new Map<string, Set<string>>();

  constructor(private readonly rules: Record<string, ToolBudgetRule>) {}

  evaluate(toolName: string, args: Record<string, unknown>): ToolBudgetDecision {
    const tool = normalizeToolName(toolName);
    const rule = this.rules[tool];
    if (!rule) return { allowed: true };

    const count = this.callCounts.get(tool) ?? 0;
    if (count >= rule.maxCalls) {
      return {
        allowed: false,
        tool,
        code: 'budget_exhausted',
        reason: `Tool budget exhausted for ${tool} (${rule.maxCalls} call(s) per turn). Use existing findings and reply DONE.`,
      };
    }

    if (rule.dedupeKey) {
      const value = dedupeValue(tool, args, rule.dedupeKey);
      if (!value) return { allowed: true };

      const setKey = `${tool}:${rule.dedupeKey}`;
      const seen = this.dedupeSets.get(setKey) ?? new Set<string>();
      if (seen.has(value)) {
        return {
          allowed: false,
          tool,
          code: 'duplicate_call',
          reason: `Duplicate ${tool} call for the same ${rule.dedupeKey}. Use prior findings and reply DONE.`,
        };
      }
    }

    return { allowed: true };
  }

  record(toolName: string, args: Record<string, unknown>): void {
    const tool = normalizeToolName(toolName);
    const rule = this.rules[tool];
    if (!rule) return;

    this.callCounts.set(tool, (this.callCounts.get(tool) ?? 0) + 1);

    if (rule.dedupeKey) {
      const value = dedupeValue(tool, args, rule.dedupeKey);
      if (!value) return;
      const setKey = `${tool}:${rule.dedupeKey}`;
      const seen = this.dedupeSets.get(setKey) ?? new Set<string>();
      seen.add(value);
      this.dedupeSets.set(setKey, seen);
    }
  }

  isExhausted(): boolean {
    for (const [tool, rule] of Object.entries(this.rules)) {
      if ((this.callCounts.get(tool) ?? 0) >= rule.maxCalls) {
        return true;
      }
    }
    return false;
  }
}
