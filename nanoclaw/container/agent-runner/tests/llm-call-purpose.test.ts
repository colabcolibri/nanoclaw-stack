import { describe, expect, test } from 'bun:test';
import {
  buildLedgerPreview,
  formatPurposeLabel,
  getPurposeMeta,
  resolvePurpose,
} from '../src/services/llm-call-purpose.js';

describe('llm-call-purpose', () => {
  test('resolvePurpose prefers stored purpose', () => {
    expect(resolvePurpose({ purpose: 'orchestrator_triage', preview: 'Síntese: oi' })).toBe(
      'orchestrator_triage',
    );
  });

  test('resolvePurpose infers from preview prefix for legacy rows', () => {
    expect(resolvePurpose({ preview: 'Triagem: {"type":"fast_path"}' })).toBe('orchestrator_triage');
    expect(resolvePurpose({ preview: 'Conversa: Oi!' })).toBe('fast_path_direct');
  });

  test('buildLedgerPreview uses catalog prefix', () => {
    expect(buildLedgerPreview('orchestrator_triage', '{"type":"fast_path"}')).toBe(
      'Triagem: {"type":"fast_path"}',
    );
  });

  test('labels are stable and not persona-specific', () => {
    expect(formatPurposeLabel('stage2_synthesis')).toBe('Síntese persona (sender)');
    expect(getPurposeMeta('fast_path_direct').shortLabel).toBe('Conversa');
  });
});
