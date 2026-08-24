# Agentes e skills (estilo AI-diretivo)

Guia para criar e manter especialistas no stack multi-agente do NanoClaw.  
Prompts internos do agent-runner ficam em **inglês**; o **Sender** fala com o usuário no idioma da mensagem.

Ver também: [agent-turn-flow.md](agent-turn-flow.md), [DEV-LOCAL.md](DEV-LOCAL.md).

---

## Arquitetura em 3 camadas

```
TOOL (código)     →  google_gmail, run_command (ncl tasks), yampi_store …
       ↑
SKILL (SKILL.md)  →  tools: [google_gmail]  + manual operacional
       ↑
AGENT (AGENT.md)  →  skills: [gmail-inbox]  + papel do worker
       ↑
Worker LLM        →  schema de tools montado por getToolsForAgent()
```

| Camada | Quem lê | Tom |
|--------|---------|-----|
| **SKILL.md** | Worker (`load_skill` ou contexto implícito) | **AI-diretivo**: tabelas, IF→CALL, regras numeradas |
| **AGENT.md** | Worker (system prompt) | Curto: Role / Execute / Output |
| **Sender** | Usuário final | Persona, calor, formatação |

**Regra de ouro:** o worker **executa**; o sender **conversa**. Nunca peça OAuth ou listas manuais no worker se a tool existe.

---

## O que NÃO é registro de skill

| Mecanismo | O que faz |
|-----------|-----------|
| `container.json` → `skills: "all"` | Symlinks em `.claude-shared/skills` (Claude SDK). **Não** define tools do worker. |
| `load_skill` | Carrega manual. **Não** adiciona tools ao schema. |
| `ToolDomainRegistry` | Catálogo de domínios de tools (validação + docs). **Não** roteia mensagens. |
| `AgentRegistry.getToolsForAgent` | Única fonte de tools por worker em produção. |

Tools do worker vêm **só** de: `AGENT.md` skills → `SKILL.md` `tools:` → `ALL_TOOLS`.

---

## Validação do registry (CI + boot)

`validateAgentRegistry()` em `container/agent-runner/src/agents/validate-registry.ts` falha com **erro** quando:

- departamento referencia `agentId` sem `AGENT.md`
- agente referencia skill inexistente
- skill declara tool que não existe em `ALL_TOOLS`
- skill exige tool que o agente não expõe no schema
- agente não resolve nenhuma tool
- skills listadas mas sem manual injetável no worker

**Quando roda:**

```bash
cd nanoclaw/container/agent-runner
bun run validate:agents   # só a checagem
bun test                  # inclui validate:agents no início
```

No **startup do container**, `assertAgentRegistryValid` aborta o processo com a lista de erros — misconfig não chega a rodar turno silencioso.

No **runtime**, `WorkerAgentRunner` também recusa executar agente com skill/tool quebrada.

---

## Criar uma skill nova

1. Pasta: `nanoclaw/container/skills/<slug>/SKILL.md`
2. Frontmatter obrigatório:

```yaml
---
name: my-skill          # DEVE bater com o slug em AGENT.md skills:
description: One line for UI catalog
domain: my_domain       # ToolDomainRegistry id (optional)
tools:
  - my_tool_name       # chave em ALL_TOOLS — não o nome da skill
---
```

3. Corpo no **estilo diretivo** (ver template abaixo).
4. Implementar a tool em `container/agent-runner/src/tools/` e registrar em `tools/index.ts`.

> **Parser:** frontmatter é parseado por um único módulo (`services/frontmatter.ts`, pacote `yaml`) com **falha alta** — YAML malformado loga erro e a skill não registra (o validador do boot acusa).

### Skill self-service pelo próprio agente (overlay do grupo)

Skills são **dados** — o agente pode criar as dele sem deploy, escrevendo em
`groups/<grupo>/skills/<slug>/SKILL.md` (montado RW no container como
`/workspace/agent/skills`). O `SkillsManager` dá precedência ao overlay do grupo
sobre as skills compartilhadas (cache TTL ~10s). Regras: `tools:` só com nomes
que existem em `ALL_TOOLS`; para plugar a skill num especialista, o `AGENT.md`
desse agente precisa listá-la (edição global exige operador).

### Template SKILL.md (AI-diretivo)

```markdown
# Short title

One-line constraint (e.g. OAuth pre-configured; CALL tool).

## Decision map

| User intent | Call / action | Params |
| :--- | :--- | :--- |
| … | `tool_name(...)` | … |

## Rules

1. CALL before claiming success.
2. NEVER …
3. DONE + structured summary. No greetings.
```

Evite: prosa longa, exemplos conversacionais, repetir arquitetura Docker salvo 1 linha.

---

## Criar um agente novo

1. Pasta: `nanoclaw/container/agents/<agent_id>/AGENT.md`
2. Frontmatter:

```yaml
---
id: my_agent
name: Display Name
department: productivity    # productivity | commerce | research_intel | operations
role: One line
description: For orchestrator catalog
skills:
  - my-skill                 # name: do SKILL.md — exato
allow_global_skills: true    # load_skill, read_file, run_command, …
---
```

3. Corpo curto (inglês):

```markdown
# Role
What this worker owns.

## Execute
- Intent → `tool_name`

## Output
DONE + structured data. No user conversation.
```

4. Registrar departamento novo em **`nanoclaw/container/agents/departments.json`** — fonte única lida pelo runner (`AgentRegistry.loadDefaultDepartments`) e pela UI. Não há lista hardcoded em código.

### Override por grupo (opcional)

`nanoclaw/groups/<grupo>/agents/<agent_id>/AGENT.md` — **sobrescreve** o compartilhado em runtime e na UI (deduplicado por `id`). Use para `model:` ou skills extras só naquele bot.

---

## Checklist antes de merge

- [ ] `name:` no SKILL.md = string em `AGENT.md` `skills:`
- [ ] Cada skill lista `tools:` que existem em `ALL_TOOLS`
- [ ] `bun test` em `container/agent-runner/tests/multi-agent.test.ts` e `skills.test.ts`
- [ ] Simular: `AgentRegistry.getToolsForAgent('<id>', '<groupDir>')` inclui as tools esperadas
- [ ] Sem build Docker para AGENT/SKILL — mounts ao vivo; rebuild só se mudar deps da imagem

---

## Prompts compartilhados do worker

| Arquivo | Função |
|---------|--------|
| `prompts/core.truthfulness.md` | Não inventar dados |
| `prompts/worker.execution.md` | Tool-first, DONE, sem conversa |

Injetados em todo `WorkerAgentRunner.execute`.

---

## Exemplo completo: calendário

**SKILL** `google-calendar` → `tools: [google_calendar]`  
**AGENT** `productivity_attendant` → `skills: [gmail-inbox, google-calendar, autonomous-scheduler]`  
**Runtime** → worker recebe `google_calendar` + `run_command`; skill `autonomous-scheduler` ensina `ncl tasks` para lembretes/cron.

Se faltar qualquer elo, o worker fica só com globais (`load_skill`, `run_command`) e tende a improvisar ou pedir dados ao usuário.

---

## Skills fora do padrão worker

| Skill | Motivo |
|-------|--------|
| `welcome` | Onboarding conversacional no canal — não é executor |
| `frontend-engineer` | Workflow de dev humano-like |
| `native-tool-builder` | Meta: expandir capacidades — skills self-service + proposta de tool nativa ao operador |

Não force caveman nesses; mantenha AI-diretivo nos skills ligados a **tools de domínio**.

---

## Tool nativa nova (código)

Tool nativa é TypeScript no `ALL_TOOLS`, shipada na imagem — **não** pode ser criada de dentro do container (`/app/src` é RO). Fluxo:

1. O agente produz uma proposta (interface, comportamento por ação, notas de segurança) em `/workspace/agent/proposals/` — ver skill `native-tool-builder`
2. O operador implementa em `container/agent-runner/src/tools/<nome>.ts`, registra em `tools/index.ts` e cria a SKILL.md companheira
3. Suite verde (`pnpm test` + `bun test`) e deploy — o validador de registry falha alto se o wiring estiver errado
