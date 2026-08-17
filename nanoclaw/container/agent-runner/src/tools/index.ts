import type { AgentTool, ToolDefinition } from './types.js';
import { runCommandTool, readFileTool } from './system.js';
import { googleCalendarTool } from './google-calendar.js';
import { googleGmailTool } from './google-gmail.js';
import { notionTool } from './notion.js';
import { yampiTool } from './yampi.js';
import { memoryTool } from './memory.js';

export const ALL_TOOLS: Record<string, AgentTool> = {
  run_command: runCommandTool,
  read_file: readFileTool,
  google_calendar: googleCalendarTool,
  google_gmail: googleGmailTool,
  notion: notionTool,
  yampi_store: yampiTool,
  manage_memory: memoryTool,
};

export const AGENT_TOOLS: ToolDefinition[] = Object.values(ALL_TOOLS).map((t) => t.definition);

export async function executeTool(name: string, args: any, cwd: string): Promise<string> {
  const tool = ALL_TOOLS[name];
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
