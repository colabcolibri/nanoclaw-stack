---
name: native-tool-builder
description: Cria e expande ferramentas nativas (Native Tools) de alta velocidade no ecossistema NanoClaw. Use quando o usuário pedir para criar novas integrações, ferramentas ou APIs (ex: WhatsApp, Notion, Trello, bancos de dados ou APIs REST).
---

# Native Tool Builder

Você pode criar novas ferramentas nativas para você mesmo e para outros assistentes no ecossistema NanoClaw.

## 🏗️ Como as Ferramentas Nativas Funcionam

Todas as ferramentas nativas ficam na pasta `/opt/nanoclaw/container/agent-runner/src/tools/` e seguem o padrão TypeScript com `AgentTool`:

```typescript
import type { AgentTool } from './types.js';

export const minhaNovaTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'nome_da_ferramenta',
      description: 'Descrição clara e detalhada para o modelo saber quando e como usar.',
      parameters: {
        type: 'object',
        properties: {
          acao: { type: 'string', enum: ['listar', 'criar'], description: 'Ação a ser executada' },
          parametro1: { type: 'string', description: 'Descrição do parâmetro' }
        },
        required: ['acao']
      }
    }
  },
  execute: async (args: any, cwd: string): Promise<string> => {
    // Lógica da ferramenta (requisição HTTP, consulta, processamento)
    return JSON.stringify({ status: 'ok', resultado: 'sucesso' });
  }
};
```

---

## 🛠️ Passo a Passo para Criar uma Nova Tool

1. **Crie o arquivo da ferramenta:**
   - Exemplo: `/opt/nanoclaw/container/agent-runner/src/tools/notion.ts`
   - Implemente o objeto que segue a interface `AgentTool`.
   - Use `fetch` nativo para chamadas HTTP ou utilitários do Node.js.

2. **Registre a ferramenta no index:**
   - Abra `/opt/nanoclaw/container/agent-runner/src/tools/index.ts`.
   - Importe sua tool: `import { minhaNovaTool } from './minha-tool.js';`
   - Adicione no objeto `ALL_TOOLS`:
     ```typescript
     export const ALL_TOOLS: Record<string, AgentTool> = {
       run_command: runCommandTool,
       read_file: readFileTool,
       google_calendar: googleCalendarTool,
       google_gmail: googleGmailTool,
       nome_da_ferramenta: minhaNovaTool,
     };
     ```

3. **Recarregue os serviços:**
   - Execute: `systemctl restart nanoclaw`
   - A nova ferramenta estará disponível instantaneamente para o assistente.
