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

export interface AgentTool {
  definition: ToolDefinition;
  execute: (args: any, cwd: string) => Promise<string>;
}
