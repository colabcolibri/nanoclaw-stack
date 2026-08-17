# NanoClaw Personal Assistant Stack

> A practical, production-ready personal assistant stack built on top of [NanoClaw](https://github.com/nanocoai/nanoclaw), customized for real-world daily workflows with a native tool runner, multi-calendar Google Workspace integration, a web control panel, and self-hosted audio transcription.

---

## 📖 About This Project

This repository is a personalized, self-hosted deployment of **NanoClaw** designed to run an autonomous personal assistant (called *Barão*) accessible via Telegram and a private web dashboard.

While the upstream NanoClaw project provides a solid multi-agent container engine, running it as a reliable daily personal assistant required several practical adaptations: replacing heavy external MCP servers with fast native tools, supporting multiple Google calendars simultaneously, adding a lightweight management UI, and handling voice messages locally.

---

## ⚡ What’s Different from Upstream NanoClaw?

| Feature | Upstream NanoClaw | This Customized Stack |
| :--- | :--- | :--- |
| **Google Calendar** | Only reads the user's single `primary` calendar. | **Multi-Calendar Parallel Aggregation**: Monitors and consolidates events across all 6 active calendars (personal, work, team, shared) in one view. |
| **Tool Execution** | Relies on heavy Claude MCP subprocesses via STDIO. | **Native Modular Tools (`/tools`)**: Direct HTTP function calling with built-in OAuth2 auto-refresh. Lightweight, fast, and compatible with DeepSeek or any OpenAI-compatible LLM. |
| **Management UI** | CLI-only or standard agent view. | **Custom Web Dashboard (`/ui`)**: Built with Bun & Hono. Includes 1-click Google OAuth2 pairing, skill toggles, and live Docker container inspection. |
| **Voice Notes** | Requires external speech-to-text APIs. | **Self-Hosted Whisper (`/whisper`)**: Local Docker container running OpenAI Whisper for instant, private Telegram audio transcription. |
| **Edge Routing & SSL** | Manual setup required. | **Traefik Proxy (`/traefik`)**: Automated Let's Encrypt SSL certificates and reverse proxy to the dashboard. |

---

## 🏛️ Project Layout

```text
nanoclaw-stack/
├── nanoclaw/         # Core NanoClaw engine adapted with native providers & tools
│   ├── container/    # Agent runner, skills, and modular tools (/tools)
│   └── src/          # Central host service, SQLite state, and Telegram bridge
│
├── ui/               # Web control dashboard (Bun + Hono + TypeScript)
│   ├── src/          # REST API, SQLite sync, Google OAuth callback handler
│   └── public/       # Clean frontend control panel
│
├── traefik/          # Automated Let's Encrypt SSL reverse proxy configuration
│   └── docker-compose.yml
│
├── whisper/          # Local audio transcription container (OpenAI Whisper ASR)
│   └── docker-compose.yml
│
└── infra/            # Documentation, persona prompts (Soul), and maintenance playbooks
    ├── BARAO_SOUL.md # Personality and behavioral directives
    ├── SERVICES.md   # Systemd unit definitions and port mappings
    └── MAINTENANCE.md# Backup strategies and update guides
```

---

## 🤔 Why a Unified Stack Instead of a Traditional Fork?

Upstream NanoClaw is strictly the agent runtime. However, a practical personal assistant ecosystem in production needs:

1. **A Web UI** to manage settings and connect OAuth services without touching JSON files.
2. **An Audio Transcriber** to handle voice notes on Telegram.
3. **An SSL Reverse Proxy** to securely expose the dashboard.
4. **Operational Documentation** for server maintenance and persona prompting.

Keeping everything in this unified repository (*monorepo*) makes it possible to clone, configure, and operate the entire personal assistant stack on any VPS while keeping the core engine easily updatable against upstream releases.

---

## 🚀 Running the Stack

```bash
# 1. Start the SSL reverse proxy
cd traefik && docker compose up -d

# 2. Start the local voice transcription service
cd ../whisper && docker compose up -d

# 3. Start the Web Control Dashboard
cd ../ui
bun install
bun run src/index.ts

# 4. Start the NanoClaw Agent Engine
cd ../nanoclaw
pnpm install
pnpm start
```

---

## 🔒 Security

All secrets, active session databases (`v2.db`), OAuth tokens (`google_tokens.json`), and private agent memories are strictly ignored by `.gitignore` and only exist locally on the host server.

---

## 📜 Credits & Acknowledgments

* Based on [NanoClaw](https://github.com/nanocoai/nanoclaw) by Nanoco AI.
* Designed and configured for personal executive and engineering automation.
