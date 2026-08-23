# Agent routing

Routing is **semantic and LLM-driven** — not keyword-based.

## Principles

1. **No keyword routing in code** — department `keywords` were removed from `AgentRegistry`. Matching user text to Portuguese/English tokens does not scale and breaks other languages.
2. **Triage is the router** — `orchestrator.triage` reads `AgentRegistry.buildTriageCatalog()` and picks `agentId` + `departmentId` by scope, role, description, and stable `capabilities` ids.
3. **Capabilities are language-neutral** — e.g. `web.research`, `metrics.tokens`. Used for supervisor termination and catalog hints, not string matching.
4. **ToolDomainRegistry** — catálogo de domínios de tools para validação (`syncRegistry`). Não roteia mensagens de usuário.

## Catalog shape (triage input)

```
## research_intel
name: Pesquisa, Inteligência & Web
scope: Buscas na web...
specialists:
- id: web_researcher
  role: Live web search...
  description: ...
  capabilities: web.research
```

The user message may be in any language. Triage infers intent from meaning, not literal words.

## Adding a specialist

1. Create `container/agents/<id>/AGENT.md` with `department`, `role`, `description`, optional `capabilities` and `execution_profile`.
2. Register the agent in the department's `agentIds` in `registry.ts` **or** rely on auto-discovery from `AGENT.md`.
3. Do **not** add keyword lists — extend `description` and `capabilities` instead.

## Related

- [slash-commands.md](slash-commands.md)
- `container/agent-runner/src/execution/` — worker profiles and tool budgets
