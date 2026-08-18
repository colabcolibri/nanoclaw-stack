---
name: native-tool-builder
description: Cria e expande ferramentas nativas (Native Tools) e habilidades por pastas (Skills) de alta velocidade e baixo consumo de tokens no ecossistema NanoClaw. Use quando o usuário pedir para criar novas integrações, ferramentas ou APIs.
domain: tool_builder
tools: [read_file, run_command]
keywords: [criar ferramenta, nova tool, nova ferramenta, tool builder, criar skill, nova skill, integração, criar api]
---

# Native Tool & Skill Builder

Esta habilidade capacita o assistente a criar, testar e registrar novas ferramentas nativas TypeScript e novas habilidades baseadas em pastas (`SKILL.md`) no ecossistema NanoClaw de forma modular e token-efficient.

---

## 🏗️ Como as Ferramentas e Skills se Organizam

O NanoClaw suporta dois níveis complementares:

1. **A Pasta da Habilidade (`container/skills/<nome-da-skill>/SKILL.md`):**
   - Contém os metadados YAML (`domain`, `tools`, `keywords`) e o **Manual Operacional** detalhado (tabelas de busca, exemplos, fluxos).
   - O `SkillsManager` descobre essa pasta automaticamente e a entrega à LLM apenas quando a ferramenta estiver ativa.

2. **A Função TypeScript da Ferramenta (`container/agent-runner/src/tools/<minha-tool>.ts`):**
   - Implementa a interface `AgentTool` com schema JSON minimalista e o código de execução assíncrono.

---

## 🛠️ Passo a Passo para Criar uma Nova Ferramenta Nativa

### 1. Criar o arquivo da ferramenta em TypeScript:
Crie `/opt/nanoclaw-stack/nanoclaw/container/agent-runner/src/tools/minha-ferramenta.ts`:

```typescript
import type { AgentTool } from './types.js';

export const minhaFerramentaTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'minha_ferramenta',
      description: 'Descrição concisa em 1 linha da funcionalidade.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['listar', 'consultar', 'executar'],
            description: 'Ação a executar.',
          },
          query: {
            type: 'string',
            description: 'Termo de busca ou parâmetro principal.',
          },
        },
        required: ['action'],
      },
    },
  },
  execute: async (args: any, cwd: string): Promise<string> => {
    // Implemente a lógica (fetch HTTP, comandos ou manipulação)
    return JSON.stringify({ status: 'ok', data: 'resultado da consulta' });
  },
};
```

### 2. Registrar no Índice de Ferramentas:
No arquivo `/opt/nanoclaw-stack/nanoclaw/container/agent-runner/src/tools/index.ts`:
- Importe sua tool: `import { minhaFerramentaTool } from './minha-ferramenta.js';`
- Adicione no objeto `ALL_TOOLS`:
  ```typescript
  export const ALL_TOOLS: Record<string, AgentTool> = {
    ...
    minha_ferramenta: minhaFerramentaTool,
  };
  ```

### 3. Criar a Pasta da Skill com o Manual Operacional:
Crie a pasta `/opt/nanoclaw-stack/nanoclaw/container/skills/minha-ferramenta/SKILL.md`:

```markdown
---
name: minha-ferramenta
description: Guia operacional completo de uso da ferramenta minha_ferramenta.
domain: meu_dominio
tools: [minha_ferramenta]
keywords: [termo1, termo2, palavra-chave, acao]
---

# Manual Operacional da Minha Ferramenta

Instruções detalhadas para a IA:
- Como compor os parâmetros
- Tabelas de filtros recomendados
- Regras de formatação de resposta
```

---

## 🧪 Como Validar e Ativar

1. **Rodar os Testes de Validação:**
   ```bash
   cd /opt/nanoclaw-stack/nanoclaw/container/agent-runner
   bun test
   ```
2. **Reiniciar o Serviço:**
   ```bash
   systemctl restart nanoclaw
   ```
   A nova ferramenta é descoberta automaticamente pelo `SkillsManager`, registrada no `ToolRouter` e ativada sob demanda com zero inchaço de tokens.
