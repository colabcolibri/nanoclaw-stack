import { describe, expect, test } from 'bun:test';
import { ToolDomainRegistry, ALL_TOOLS } from '../src/tools/index.js';

describe('ToolDomainRegistry', () => {
  test('syncRegistry accepts all built-in tools', () => {
    expect(() => ToolDomainRegistry.syncRegistry(ALL_TOOLS)).not.toThrow();
  });

  test('every registered tool maps to a known domain', () => {
    ToolDomainRegistry.syncRegistry(ALL_TOOLS);
    for (const [name, tool] of Object.entries(ALL_TOOLS)) {
      expect(tool.domain, name).toBeTruthy();
      expect(ToolDomainRegistry.getDomain(tool.domain!), name).toBeDefined();
    }
  });

  test('registerDomain merges tool names for dynamic skills', () => {
    ToolDomainRegistry.registerDomain({
      id: 'crm',
      name: 'CRM',
      description: 'Customer pipeline tools',
      toolNames: ['hubspot_leads'],
    });

    const domain = ToolDomainRegistry.getDomain('crm');
    expect(domain?.toolNames).toContain('hubspot_leads');
  });

  test('syncRegistry rejects tools without domain', () => {
    // Intentionally malformed input — the runtime must reject it, so the type
    // hole is deliberate and goes through `unknown`.
    const broken = {
      orphan: {
        definition: ALL_TOOLS.web_search.definition,
        execute: ALL_TOOLS.web_search.execute,
      },
    } as unknown as typeof ALL_TOOLS;

    expect(() => ToolDomainRegistry.syncRegistry(broken)).toThrow(/has no assigned domain/);
  });

  test('getGroupSummaryPrompt lists domains with tools', () => {
    ToolDomainRegistry.syncRegistry(ALL_TOOLS);
    const prompt = ToolDomainRegistry.getGroupSummaryPrompt();
    expect(prompt).toContain('web_research');
    expect(prompt).toContain('web_search');
    expect(prompt).not.toContain('runtime_meta');
  });

  test('executeTool resolves web_research alias to web_search', async () => {
    const { executeTool } = await import('../src/tools/index.js');
    const result = await executeTool('web_research', { query: '' }, process.cwd());
    expect(result).toContain('query parameter is required');
  });
});
