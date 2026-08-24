# Documentação — NanoClaw Stack

Mapa de toda a documentação, por audiência. Comece pelo [README raiz](../README.md) para visão geral.

## 🧑‍💼 Operador (dia a dia)

| Doc | O que cobre |
|---|---|
| [DEV-LOCAL.md](DEV-LOCAL.md) | Rodar UI + motor no Mac; quando Docker é necessário |
| [DEPLOY.md](DEPLOY.md) | Deploy em produção: `./scripts/deploy.sh` (push + SSH), filosofia sem CI-secrets |
| [agents-and-skills.md](agents-and-skills.md) | **Registrar agente, skill, tool ou departamento novo** (o "como estender") |
| [agent-turn-flow.md](agent-turn-flow.md) | O que acontece num turno, ponta a ponta |

## 🛠️ Ops do VPS

| Doc | O que cobre |
|---|---|
| [../infra/README.md](../infra/README.md) | Índice da infra |
| [../infra/SERVICES.md](../infra/SERVICES.md) | Topologia de serviços e portas |
| [../infra/MAINTENANCE.md](../infra/MAINTENANCE.md) | Backup, logs, restart de serviços no servidor |
| [../infra/MACOS_INTEGRATION.md](../infra/MACOS_INTEGRATION.md) | App Barão (macOS): Shortcuts, Siri, canal dedicado |
| [../infra/WHISPER.md](../infra/WHISPER.md) | Transcrição de áudio local |
| [../infra/ARCHITECTURE_PHILOSOPHY.md](../infra/ARCHITECTURE_PHILOSOPHY.md) | Princípios de design do stack |
| [../traefik/](../traefik/) | Proxy TLS + rate limit das rotas de auth (`dynamic_conf.yml`) |

## 🔧 Motor multi-agente (dev)

Tudo em [`nanoclaw/docs/`](../nanoclaw/docs/README.md) — índice com os 17 docs internos
(arquitetura, bancos, roteamento, skills, memória, operação).

Atalhos frequentes:

| Assunto | Onde |
|---|---|
| Registrar agente/skill/tool/departamento | [agents-and-skills.md](agents-and-skills.md) |
| Arquitetura interna completa | [nanoclaw/docs/architecture.md](../nanoclaw/docs/architecture.md) |
| Modelo de segurança | [nanoclaw/docs/SECURITY.md](../nanoclaw/docs/SECURITY.md) |

## 🖥️ Interfaces

| Doc | O que cobre |
|---|---|
| [../ui/README.md](../ui/README.md) | Dashboard web (backend Bun + client React) |
| [../ui/client/DESIGN.md](../ui/client/DESIGN.md) | Convenções visuais do frontend |
| [../clients/macos/README.md](../clients/macos/README.md) | App nativo macOS |

## Qualidade

```bash
# CI roda isso a cada PR (.github/workflows/ci.yml):
cd nanoclaw && pnpm typecheck && pnpm lint && pnpm test   # motor host (1086 testes)
cd nanoclaw/container/agent-runner && bun test            # runner (250 testes)
cd ui && bunx tsc --noEmit && bun test src                # backend UI
cd ui/client && bun run lint && bun run build             # frontend
```
