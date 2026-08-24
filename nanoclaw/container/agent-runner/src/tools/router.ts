import type { AgentTool } from './types.js';

/**
 * Tool domain catalog — groups tools for validation and documentation only.
 * Does NOT route user messages. Agent routing is LLM triage + AgentRegistry.
 */
export interface ToolDomain {
  id: string;
  name: string;
  description: string;
  toolNames: string[];
}

export class ToolDomainRegistry {
  private static domains: Map<string, ToolDomain> = new Map();
  private static registry: Record<string, AgentTool> = {};

  static {
    this.registerDomain({
      id: 'google_suite',
      name: 'Google Suite (Gmail & Calendar)',
      description: 'Email, calendar, and Google Workspace actions.',
      toolNames: ['google_gmail', 'google_calendar'],
    });

    this.registerDomain({
      id: 'ecommerce_logistics',
      name: 'E-Commerce, Pricing & Logistics',
      description: 'Yampi store, resale pricing, and Correios shipping.',
      toolNames: ['yampi_store', 'resale_pricing', 'correios_shipping'],
    });

    this.registerDomain({
      id: 'notion_management',
      name: 'Notion',
      description: 'Notion pages, notes, and databases.',
      toolNames: ['notion'],
    });

    this.registerDomain({
      id: 'automation_scheduling',
      name: 'Scheduling & Follow-ups',
      description: 'Cron-style follow-ups and autonomous reminders via ncl tasks.',
      toolNames: ['run_command'],
    });

    this.registerDomain({
      id: 'core_system',
      name: 'System, Memory & Files',
      description: 'Long-term memory, file reads, and safe commands.',
      toolNames: ['manage_memory', 'read_file', 'run_command'],
    });

    this.registerDomain({
      id: 'web_research',
      name: 'Web Research',
      description: 'Live web search and URL extraction.',
      toolNames: ['web_search', 'browse_url'],
    });

    this.registerDomain({
      id: 'runtime_meta',
      name: 'Runtime Meta',
      description: 'Dynamic skill loading and message context retrieval.',
      toolNames: ['load_skill', 'retrieve_message_context'],
    });

    this.registerDomain({
      id: 'metrics',
      name: 'Token & Cost Metrics',
      description: 'LLM token ledger and cost analytics.',
      toolNames: ['token_usage'],
    });
  }

  static registerDomain(domain: ToolDomain): void {
    const existing = this.domains.get(domain.id);
    if (!existing) {
      this.domains.set(domain.id, {
        ...domain,
        toolNames: [...domain.toolNames],
      });
      return;
    }

    const toolSet = new Set([...existing.toolNames, ...domain.toolNames]);
    this.domains.set(domain.id, {
      id: domain.id,
      name: existing.name || domain.name,
      description: existing.description || domain.description,
      toolNames: Array.from(toolSet),
    });
  }

  /**
   * Validates every tool has a registered domain and syncs domain.toolNames from ALL_TOOLS.
   */
  static syncRegistry(tools: Record<string, AgentTool>): void {
    for (const [toolName, tool] of Object.entries(tools)) {
      if (!tool.domain || typeof tool.domain !== 'string' || !tool.domain.trim()) {
        throw new Error(
          `[Strict Tool Registry] Tool "${toolName}" has no assigned domain! Every tool must belong to a group.`,
        );
      }
      if (!this.domains.has(tool.domain)) {
        throw new Error(
          `[Strict Tool Registry] Tool "${toolName}" belongs to unknown domain "${tool.domain}". Register the domain first!`,
        );
      }
    }

    this.registry = { ...tools };

    for (const [domId, domain] of this.domains.entries()) {
      const matchingTools = Object.entries(tools)
        .filter(([, t]) => t.domain === domId)
        .map(([name]) => name);

      const combined = new Set([...domain.toolNames, ...matchingTools]);
      domain.toolNames = Array.from(combined);
    }
  }

  static getGroupSummaryPrompt(): string {
    const lines: string[] = ['## Tool capability groups (reference):'];
    for (const [id, dom] of this.domains.entries()) {
      if (id === 'runtime_meta') continue;
      if (dom.toolNames.length === 0) continue;
      lines.push(
        `- **${dom.name}** (\`${id}\`): ${dom.description} [tools: ${dom.toolNames.map((t) => `\`${t}\``).join(', ')}]`,
      );
    }
    return lines.join('\n');
  }

  static getDomain(domainId: string): ToolDomain | undefined {
    return this.domains.get(domainId);
  }

  static getDomains(): ToolDomain[] {
    return Array.from(this.domains.values());
  }
}
