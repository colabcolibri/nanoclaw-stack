import { MemoService, type MessageMemoEntry } from './memo-service.js';
import { MemoryManager } from './memory.js';

export type SoulMode = 'compact' | 'full';

export interface ContextPlan {
  /** IDs de memos recentes que o orquestrador julgou relevantes para o sender. */
  memoIds?: string[];
  /** Incluir índice compacto da memória de longo prazo (só títulos/fatos curtos). */
  includeMemoryIndex?: boolean;
  /** compact = soul resumida; full = soul completa (só quando o orquestrador pedir). */
  soulMode?: SoulMode;
}

export const DEFAULT_FAST_CONTEXT_PLAN: ContextPlan = {
  memoIds: [],
  includeMemoryIndex: false,
  soulMode: 'compact',
};

export const DEFAULT_SYNTHESIS_CONTEXT_PLAN: ContextPlan = {
  memoIds: [],
  includeMemoryIndex: true,
  soulMode: 'compact',
};

/**
 * Monta contexto conversacional enxuto a partir de memos e índice de memória.
 * O orquestrador (LLM) decide quais memos incluir via ContextPlan.
 */
export class ContextPack {
  static formatMemoIndex(limit = 8): string {
    const memos = MemoService.getRecentMemos(limit);
    if (memos.length === 0) return '(no recent memos)';

    return memos
      .map((m) => `- [id: ${m.id} | ${m.role}]: "${m.memo}"`)
      .join('\n');
  }

  static resolveMemos(plan: ContextPlan | undefined, isFastPath: boolean): MessageMemoEntry[] {
    const recent = MemoService.getRecentMemos(12);
    const ids = plan?.memoIds?.filter(Boolean) ?? [];

    if (ids.length > 0) {
      const idSet = new Set(ids);
      return recent.filter((m) => idSet.has(m.id));
    }

    if (isFastPath) return [];

    return recent.slice(-6);
  }

  static formatMemosSection(memos: MessageMemoEntry[]): string {
    if (memos.length === 0) return '';

    const lines = memos.map((m) => `- [id: ${m.id} | ${m.role}]: "${m.memo}"`);
    return `## Recent context (memos)\n${lines.join('\n')}\n\nUse only what is needed to answer.`;
  }

  static buildMemorySection(cwd: string, plan: ContextPlan | undefined): string {
    if (!plan?.includeMemoryIndex) return '';
    const index = MemoryManager.loadMemoryIndex(cwd);
    if (!index) return '';
    return `## Long-term memory index\n${index}`;
  }
}
