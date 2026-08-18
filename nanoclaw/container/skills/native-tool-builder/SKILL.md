---
name: native-tool-builder
description: Creates and expands high-performance, token-efficient Native TypeScript Tools and folder-based Skills in the NanoClaw ecosystem. Use when requested to develop new tools, integrations, or APIs.
domain: tool_builder
tools: [read_file, run_command]
keywords: [create tool, new tool, tool builder, create skill, new skill, integration, create api]
---

# Native Tool & Skill Builder

This skill empowers the assistant to construct, test, and register modular TypeScript native tools and folder-based skills (`SKILL.md`) in the NanoClaw runtime with zero token bloat.

---

## 🏗️ Architecture: Tools and Skills Separation

NanoClaw enforces a clean 2-tier division:

1. **The Skill Folder (`container/skills/<skill-name>/SKILL.md`):**
   - Contains YAML metadata (`domain`, `tools`, `keywords`) and the operational manual (query patterns, schemas, response standards).
   - Automatically discovered by `SkillsManager` and loaded into the LLM context only when the corresponding domain tools are activated.

2. **The Native Tool Implementation (`container/agent-runner/src/tools/<my-tool>.ts`):**
   - Implements the `AgentTool` interface with lightweight JSON schema parameters and async execution code.

---

## 🛠️ Step-by-Step: Adding a New Native Tool

### 1. Create the Tool in TypeScript:
Create `/opt/nanoclaw-stack/nanoclaw/container/agent-runner/src/tools/my-tool.ts`:

```typescript
import type { AgentTool } from './types.js';

export const myTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'my_tool',
      description: 'Concise 1-line description of the tool capability.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'fetch', 'execute'],
            description: 'Action to perform.',
          },
          query: {
            type: 'string',
            description: 'Search query or primary parameter.',
          },
        },
        required: ['action'],
      },
    },
  },
  execute: async (args: any, cwd: string): Promise<string> => {
    // Implement execution logic (HTTP fetch, command, or data transformation)
    return JSON.stringify({ status: 'ok', data: 'result data' });
  },
};
```

### 2. Register in Tool Index:
In `/opt/nanoclaw-stack/nanoclaw/container/agent-runner/src/tools/index.ts`:
- Import your tool: `import { myTool } from './my-tool.js';`
- Add to `ALL_TOOLS` object:
  ```typescript
  export const ALL_TOOLS: Record<string, AgentTool> = {
    ...
    my_tool: myTool,
  };
  ```

### 3. Create the Skill Folder with the Operational Manual:
Create `/opt/nanoclaw-stack/nanoclaw/container/skills/my-tool/SKILL.md`:

```markdown
---
name: my-tool
description: Complete operational guidelines for using my_tool.
domain: custom_domain
tools: [my_tool]
keywords: [keyword1, keyword2, action]
---

# Operational Manual for My Tool

Detailed instructions for the AI:
- Parameter composition patterns
- Best practices and examples
- Output formatting requirements
```

---

## 🧪 Validation & Deployment

1. **Run Unit Tests:**
   ```bash
   cd /opt/nanoclaw-stack/nanoclaw/container/agent-runner
   bun test
   ```
2. **Restart Runtime Service:**
   ```bash
   systemctl restart nanoclaw
   ```
   The new tool is discovered automatically by `SkillsManager`, routed by `ToolRouter`, and executed on demand with zero overhead.
