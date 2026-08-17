# Infrastructure & Operational Playbooks

This directory contains system-level operational playbooks, architecture specifications, deployment guides, and maintenance procedures for operating the **NanoClaw Production Stack** on Linux servers.

---

## 📁 Directory Structure & Documentation Map

| Document | Description |
| :--- | :--- |
| **[ARCHITECTURE_PHILOSOPHY.md](file:///opt/nanoclaw-stack/infra/ARCHITECTURE_PHILOSOPHY.md)** | Core design principles, the satellite pattern, and upstream compatibility rules. |
| **[SERVICES.md](file:///opt/nanoclaw-stack/infra/SERVICES.md)** | Systemd service topologies, port allocations, status checks, and process management. |
| **[MAINTENANCE.md](file:///opt/nanoclaw-stack/infra/MAINTENANCE.md)** | Backup/restore playbooks, log inspection routines, and database maintenance. |
| **[DEEPSEEK.md](file:///opt/nanoclaw-stack/infra/DEEPSEEK.md)** | Direct API connector specifications, context window management, and provider configuration. |
| **[WHISPER.md](file:///opt/nanoclaw-stack/infra/WHISPER.md)** | Self-hosted audio transcription service configuration and media pipeline. |

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
        │  (Bun / Hono)      │   │  (Node / TSX Engine)     │
        └────────────────────┘   └─────────────┬────────────┘
                                               │
                                               │ Internal API / Localhost:9000
                                               ▼
                                 ┌──────────────────────────┐
                                 │   Whisper ASR Service    │
                                 │   (Docker: whisper-asr)  │
                                 └──────────────────────────┘
```

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
