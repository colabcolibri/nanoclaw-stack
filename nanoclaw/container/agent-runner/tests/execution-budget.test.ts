import { describe, expect, test } from 'bun:test';
import { BudgetLedger } from '../src/execution/budget-ledger.js';

describe('BudgetLedger', () => {
  test('blocks duplicate web_search queries in the same turn', () => {
    const ledger = new BudgetLedger({
      web_search: { maxCalls: 2, dedupeKey: 'query' },
    });

    const args = { query: 'nano banana' };
    expect(ledger.evaluate('web_search', args).allowed).toBe(true);
    ledger.record('web_search', args);

    const dup = ledger.evaluate('web_search', args);
    expect(dup.allowed).toBe(false);
    if (!dup.allowed) {
      expect(dup.code).toBe('duplicate_call');
    }
  });

  test('normalizes web_research alias', () => {
    const ledger = new BudgetLedger({
      web_search: { maxCalls: 1 },
    });

    ledger.record('web_research', { query: 'test' });
    const second = ledger.evaluate('web_search', { query: 'other' });
    expect(second.allowed).toBe(false);
    if (!second.allowed) {
      expect(second.code).toBe('budget_exhausted');
    }
  });
});
