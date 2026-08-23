import type { AgentTool, ToolDefinition } from './types.js';
import { ToolDomainRegistry } from './router.js';
import { runCommandTool, readFileTool } from './system.js';
import { googleCalendarTool } from './google-calendar.js';
import { googleGmailTool } from './google-gmail.js';
import { notionTool } from './notion.js';
import { yampiTool } from './yampi.js';
import { memoryTool } from './memory.js';
import { schedulerTool } from './scheduler.js';
import { resalePricingTool } from './resale-pricing.js';
import { correiosShippingTool } from './shipping.js';
import { tokenUsageTool } from './token-usage.js';
import { RETRIEVE_MESSAGE_CONTEXT_TOOL, handleRetrieveMessageContext } from './message-context.js';
import { LOAD_SKILL_TOOL, handleLoadSkill } from './load-skill.js';
import { webSearchTool, browseUrlTool } from './web-search.js';

export const ALL_TOOLS: Record<string, AgentTool> = {
  run_command: runCommandTool,
  read_file: readFileTool,
  google_calendar: googleCalendarTool,
  google_gmail: googleGmailTool,
  notion: notionTool,
  yampi_store: yampiTool,
  resale_pricing: resalePricingTool,
  correios_shipping: correiosShippingTool,
  manage_memory: memoryTool,
  schedule_followup: schedulerTool,
  token_usage: tokenUsageTool,
  web_search: webSearchTool,
  browse_url: browseUrlTool,
  retrieve_message_context: {
    domain: 'runtime_meta',
    definition: RETRIEVE_MESSAGE_CONTEXT_TOOL,
    execute: async (args: any, _cwd: string) => handleRetrieveMessageContext(args),
  },
  load_skill: {
    domain: 'runtime_meta',
    definition: LOAD_SKILL_TOOL,
    execute: async (args: any, cwd: string) => handleLoadSkill(args, cwd),
  },
};

// Strict invariant: every tool belongs to a registered domain
ToolDomainRegistry.syncRegistry(ALL_TOOLS);

export const AGENT_TOOLS: ToolDefinition[] = Object.values(ALL_TOOLS).map((t) => t.definition);

export async function executeTool(name: string, args: any, cwd: string): Promise<string> {
  const normalized = name.toLowerCase().replace(/-/g, '_');
  const resolved = normalized === 'web_research' ? 'web_search' : normalized;
  const tool = ALL_TOOLS[name] || ALL_TOOLS[normalized] || ALL_TOOLS[resolved];
  if (!tool) {
    return `Ferramenta desconhecida: ${name}`;
  }
  try {
    return await tool.execute(args, cwd);
  } catch (err: any) {
    return `Erro ao executar ${name}: ${err.message || String(err)}`;
  }
}

export * from './types.js';
export * from './router.js';
