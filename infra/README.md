# Infrastructure & Operational Playbooks

This directory contains system-level operational playbooks, architecture specifications, deployment guides, and maintenance procedures for operating the **NanoClaw Production Stack** on Linux servers.

---

## 📁 Directory Structure & Documentation Map

| Document | Description |
| :--- | :--- |
| **[ARCHITECTURE_PHILOSOPHY.md](ARCHITECTURE_PHILOSOPHY.md)** | Core design principles, the satellite pattern, and upstream compatibility rules. |
| **[MACOS_INTEGRATION.md](MACOS_INTEGRATION.md)** | Apple Shortcuts setup, global keyboard hotkeys, Siri integration, and SQLite channel isolation. |
| **[SERVICES.md](SERVICES.md)** | Systemd service topologies, port allocations, status checks, and process management. |
| **[MAINTENANCE.md](MAINTENANCE.md)** | Backup/restore playbooks, log inspection routines, and database maintenance. |
| **[DEV-LOCAL.md](../docs/DEV-LOCAL.md)** | Desenvolvimento local (UI/motor), quando o Docker é obrigatório. |
| **[DEPLOY.md](../docs/DEPLOY.md)** | Deploy com `./scripts/deploy.sh` — push + SSH + restart no VPS. |
| **[DEEPSEEK.md](DEEPSEEK.md)** *(histórico)* | Direct API connector specifications, TurnOrchestrator architecture, and response normalization. |
| **[WHISPER.md](WHISPER.md)** | Self-hosted audio transcription service configuration and media pipeline. |

---

## ⚙️ Service Topology & Ports

```text
               ┌───────────────────────────────┐
               │    Public Internet / Edge     │
               └──────────────┬────────────────┘
                              │ Port 80/443 (HTTPS)
                              ▼
               ┌───────────────────────────────┐
               │     Traefik Edge Proxy        │ (Docker: traefik)
               └───────┬───────────────┬───────┘
                       │               │
       Port 3001 (HTTP)│               │ Port 3000 (HTTP Webhooks)
                       ▼               ▼
        ┌────────────────────┐   ┌──────────────────────────┐
        │  Web Dashboard UI  │   │  NanoClaw Host Service   │
        │  (Bun)      │   │  (Node / TSX Engine)     │
        └────────────────────┘   └─────────────┬────────────┘
                                               │
                                               │ Internal API / Localhost:9000
                                               ▼
                                 ┌──────────────────────────┐
                                 │   Whisper ASR Service    │
                                 │   (Docker: whisper-asr)  │
                                 └──────────────────────────┘
```

> O Traefik aplica rate limit dedicado às rotas `/api/auth/*` (`dynamic_conf.yml`). CI no GitHub Actions valida typecheck/lint/testes a cada PR.

---

## 🔒 Configuration & Environment Variables

Environment variables are isolated into local `.env` files per subsystem (excluded from source control):

1. **`nanoclaw/.env`** — Core engine settings, active chat provider keys, channel tokens.
2. **`ui/.env`** — Web panel port, allowed login emails, Resend API key, session secret.
3. **`traefik/dynamic_conf.yml`** — Domain routing and Let's Encrypt certificate resolvers.

---

## 🧠 Managing Bot Personas & Memories

Personal bot identities (Souls) and persistent memories are managed **per agent group** inside `nanoclaw/groups/<bot_name>/` (e.g. `instructions.prepend.md` and `memory/`). 

These files reside in local host storage and are managed dynamically via the Web Dashboard (`/ui`) or directly by the agent runtime.
