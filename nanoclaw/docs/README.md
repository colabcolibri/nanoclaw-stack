# Documentação do motor (nanoclaw)

Guia de navegação. **Regra de ouro:** quando um doc e o código divergirem, vale o código — os docs aqui são mapas, não spec linha-a-linha.

## Por onde começar

| Doc | O que cobre |
|---|---|
| [architecture.md](architecture.md) | Design geral: DB em dois níveis, fluxo de mensagens, ciclo do container, schema das sessões. **Draft** — denso, mas o mais completo |
| [build-and-runtime.md](build-and-runtime.md) | Split host Node / container Bun, imagem Docker, comunicação via SQLite |
| [SECURITY.md](SECURITY.md) | Modelo de segurança: sandbox, mounts RO, egress lockdown, guard host-side |

## Dados

| Doc | O que cobre |
|---|---|
| [db.md](db.md) | Orientação: os três bancos e as invariantes entre eles |
| [db-session.md](db-session.md) | Par `inbound.db`/`outbound.db` de cada sessão (colunas, regra single-writer) |

DB central (`data/v2.db`): tabelas definidas em `src/db/*.ts`, migrations em `src/db/migrations/`.

## Agentes e roteamento

| Doc | O que cobre |
|---|---|
| [agent-routing.md](agent-routing.md) | Roteamento semântico triage → departamento → especialista |
| [memory.md](memory.md) | Memória persistente por grupo (Markdown puro, sobrevive a restarts) |
| [isolation-model.md](isolation-model.md) | Níveis de isolamento canal ↔ agente |

**Como registrar agente/skill/tool/departamento novo:** [`docs/agents-and-skills.md`](../../docs/agents-and-skills.md) na raiz do stack.

## Skills

| Doc | O que cobre |
|---|---|
| [skills-model.md](skills-model.md) | Por que o modelo de skills funciona assim (forks sem quebrar) |
| [skill-guidelines.md](skill-guidelines.md) | Checklist autoritativo de qualidade de uma SKILL.md |
| [skill-directives.md](skill-directives.md) | Gramática das diretivas `nc:` aplicáveis por máquina |
| [skill-engine-seam.md](skill-engine-seam.md) | **Histórico** — rationale da fronteira skill↔engine (formato já implementado) |

## Operação

| Doc | O que cobre |
|---|---|
| [scheduled-tasks.md](scheduled-tasks.md) | Tarefas agendadas/cron (`ncl tasks`) |
| [slash-commands.md](slash-commands.md) | `/new`, `/clear`, etc. — tratados no host antes do container |
| [provider-migration.md](provider-migration.md) | Trocar um grupo de provider (ex.: Claude ↔ Codex) |
| [onecli-upgrades.md](onecli-upgrades.md) | Upgrade do gateway OneCLI (detect → upgrade → verify → rollback) |
| [upgrade-recovery.md](upgrade-recovery.md) | Recuperação quando o motor recusa iniciar após update mal-sucedido |
