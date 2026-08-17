# NanoClaw Personal Assistant Stack

> A modular, production-ready personal AI assistant ecosystem built on top of [NanoClaw](https://github.com/nanocoai/nanoclaw), designed to be model-agnostic, channel-agnostic, and self-hosted with zero vendor lock-in.

---

## 🧭 Overview

**NanoClaw Personal Assistant Stack** is a complete, self-hosted deployment architecture that turns the NanoClaw multi-agent runtime into a daily operational assistant.

Rather than coupling the system to a single AI vendor or chat app, this stack is architected around **modularity and independence**:
* **Channel-Agnostic**: Connects to any messaging interface (Telegram, Slack, Discord, CLI, or custom webhooks) through pluggable adapters.
* **Model-Agnostic with Turn Orchestration**: Features a dedicated `TurnOrchestrator` engine that handles tool execution loops, immediate conversational feedback, and response normalization across DeepSeek, OpenAI, Claude, or local LLMs.
* **Tool-Agnostic & High-Speed**: Standardized native tools (`/tools`) that execute API calls directly in milliseconds with automated token lifecycle management (Google Calendar, Gmail, Notion, System Shell).
* **Self-Contained Infrastructure**: Bundles a web control panel, automated SSL edge routing, and local audio transcription into a single reproducible monorepo.

---

## ⚡ Key Architectural Adaptations

| Layer | Upstream NanoClaw | This Unified Stack |
| :--- | :--- | :--- |
| **Tool System** | Relies primarily on heavy Claude CLI STDIO MCP subprocesses. | **Native Modular Tools (`/tools`)**: Direct, lightweight function-calling modules for Google Calendar (multi-agenda), Gmail, and Notion with automated token handling. |
| **Turn Execution Engine** | Ad-hoc string parsing inside provider files. | **Decoupled TurnOrchestrator (`/orchestrator`)**: Hybrid JSON + DSML parser, pre-tool user notifications, and guaranteed natural language closure. |
| **Control & Management** | Terminal CLI and config files. | **Web Control Dashboard (`/ui`)**: Built with Bun & Hono. Features 1-click Google OAuth2 & Notion pairing, live container lifecycle monitoring, and multi-agent configuration. |
| **Audio & Voice** | Requires external cloud speech APIs. | **Local Audio Transcription (`/whisper`)**: Self-hosted OpenAI Whisper service for fast, private processing of incoming voice notes from any channel. |
| **Edge Routing & SSL** | Manual reverse proxy setup. | **Traefik SSL Proxy (`/traefik`)**: Automated Let's Encrypt TLS certificate provisioning and secure routing to internal services. |

---

## 🏛️ System Architecture

```text
nanoclaw-stack/
├── nanoclaw/         # Core Multi-Agent Container Engine
│   ├── container/    # Ephemeral Docker runner, skills, orchestrator, and tools
│   │   ├── agent-runner/src/orchestrator/ # TurnOrchestrator engine
│   │   ├── agent-runner/src/tools/        # Native modular tools (Notion, Google, System)
│   │   └── skills/                        # Skills (notion-notes, native-tool-builder, etc.)
│   └── src/          # Channel adapters (Telegram, CLI, etc.), SQLite state, message router
│
├── ui/               # Web Management Dashboard (Bun + Hono + TypeScript)
│   ├── src/          # API, database sync, OAuth callbacks, Notion & Google connectors
│   └── public/       # Responsive control panel
│
├── traefik/          # Automated SSL Edge Proxy (Docker)
│   └── docker-compose.yml
│
├── whisper/          # Local Audio Transcription Service (OpenAI Whisper ASR)
│   └── docker-compose.yml
│
└── infra/            # Systemd service playbooks, architecture principles, and ops manuals
    ├── ARCHITECTURE_PHILOSOPHY.md # The satellite pattern & design principles
    ├── DEEPSEEK.md                # Model connector & orchestrator specs
    ├── SERVICES.md                # Service topologies and port mappings
    └── MAINTENANCE.md             # Backup strategies and update workflows
```

---

## 💡 Why a Monorepo Stack (Instead of a Traditional Fork)?

Upstream NanoClaw focuses strictly on the agent runtime engine. However, operating an autonomous assistant in a real-world multi-device setup requires:

1. **A Control Surface (`/ui`)**: To manage bot personalities, inspect logs, and authenticate third-party services via web OAuth flows.
2. **Edge Security (`/traefik`)**: To route external traffic securely with automated HTTPS certificates.
3. **Media Processing (`/whisper`)**: To process voice messages locally without sending audio to third-party APIs.
4. **Operational Playbooks (`/infra`)**: To manage systemd services, backups, and prompt architectures.

Consolidating these components into a single stack creates a **turnkey, reproducible deployment** that can be stood up on any server in minutes while maintaining clear separation from the upstream engine.

---

## 🚀 Quick Start

### 1. Launch Edge Routing & Microservices
```bash
# Start Traefik (SSL) & Whisper (Audio Transcription)
cd traefik && docker compose up -d
cd ../whisper && docker compose up -d
```

### 2. Start the Web Control Dashboard
```bash
cd ../ui
bun install
bun run src/index.ts
```

### 3. Start the NanoClaw Engine
```bash
cd ../nanoclaw
pnpm install
pnpm start
```

---

## 🔒 Privacy & Security

* **Zero-Secret Commits**: All credentials, tokens (`google_tokens.json`, `notion_tokens.json`), databases (`v2.db`), and `.env` files are strictly isolated locally and excluded via `.gitignore`.
* **Sandboxed Execution**: Agent sessions run inside ephemeral, isolated Docker containers with strictly scoped filesystem boundaries.

---

## 📜 Credits & Acknowledgments

* Engine built upon [NanoClaw](https://github.com/nanocoai/nanoclaw) by Nanoco AI.
* Adapted and extended as an omnichannel, privacy-focused autonomous assistant platform.
