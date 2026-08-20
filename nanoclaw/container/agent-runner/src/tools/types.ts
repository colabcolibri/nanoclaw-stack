export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export type ToolDomainId =
  | 'google_suite'
  | 'ecommerce_logistics'
  | 'notion_management'
  | 'automation_scheduling'
  | 'core_system'
  | 'web_research'
  | 'runtime_meta';

export interface AgentTool {
  domain: ToolDomainId | string;
  definition: ToolDefinition;
  execute: (args: any, cwd: string) => Promise<string>;
}
