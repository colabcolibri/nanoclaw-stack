# NanoClaw Production Stack

> An enterprise-grade, multi-agent AI assistant ecosystem powered by DeepSeek, featuring a real-time web control panel, native high-performance tools, multi-calendar Google Workspace integration, automated SSL reverse proxy, and self-hosted voice transcription.

---

## 🌟 Overview

**NanoClaw Production Stack** is an end-to-end, production-ready AI orchestration platform designed to operate autonomous multi-agent assistants (e.g., executive, engineering, and personal automation bots). 

This project unifies the core agent runtime engine with an executive web control panel, modular native function calling, automated Traefik SSL reverse proxy, and self-hosted microservices into a single, cohesive architecture.

---

## 🏛️ System Architecture

```text
nanoclaw-stack/
├── nanoclaw/         # Core Multi-Agent Runtime Engine
│   ├── src/          # Central host service, database, channels (Telegram, CLI)
│   ├── container/    # Ephemeral Docker runner, native providers, skills
│   └── tools/        # Modular native tool implementations (Calendar, Gmail, System)
│
├── ui/               # Executive Web Control Dashboard (Bun + Hono + TypeScript)
│   ├── src/          # REST API, SQLite sync, 1-click Google OAuth2, auth
│   └── public/       # Responsive control panel interface
│
├── traefik/          # Automated SSL (Let's Encrypt) Reverse Proxy (Docker)
│   ├── docker-compose.yml
│   ├── traefik.yml
│   └── dynamic_conf.yml
│
├── whisper/          # Self-hosted OpenAI Whisper ASR Docker Webservice
│   └── docker-compose.yml
│
└── infra/            # Architecture blueprints, service configs & systemd playbooks
    ├── SERVICES.md   # Service definitions, ports, and lifecycle controls
    ├── DEEPSEEK.md   # DeepSeek provider parameters & context optimization
    ├── BARAO_SOUL.md # Agent persona definition & cognitive directives
    └── MAINTENANCE.md# Backup strategies, log monitoring, and operations
```

---

## 🚀 Key Features & Engineering Highlights

### 1. High-Performance Native Function Calling (DeepSeek Engine)
* **Zero-Overhead Tools**: Replaced traditional, heavy STDIO MCP subprocess handshakes with native `/v1/chat/completions` function calling, cutting execution latency to single-digit milliseconds.
* **Modular Tool Architecture (`/tools`)**: Standardized `AgentTool` interface allowing new tools (Notion, CRMs, WhatsApp, REST APIs) to be added as isolated Lego blocks.

### 2. Multi-Calendar Google Workspace Integration
* **Parallel Aggregation**: Unlike standard calendar plugins that only query the primary calendar, this integration fetches from `users/me/calendarList` and aggregates events across **all monitored calendars** (primary, secondary, shared, and team calendars) in parallel.
* **Autonomous OAuth2 Refresh**: Transparently manages token lifecycles with exponential backoff and auto-refresh without user intervention.

### 3. Real-Time Web Control Panel (`/ui`)
* **Multi-Agent Management**: Live configuration of assistant prompts, models, container resources, and skills.
* **1-Click OAuth Flow**: Seamless web authorization flow saving tokens directly into the agent group workspaces.
* **Docker Container Monitor**: Real-time observability of running containers, memory metrics, and lifecycle events.

### 4. Edge Routing & Automated HTTPS (`/traefik`)
* **Automated Let's Encrypt SSL**: Automatic TLS certificate provisioning and renewal.
* **HTTP to HTTPS Redirection**: Enforces strict transport security and modern cipher suites.
* **Host Routing**: Direct routing from public domains to internal microservices without port exposure.

### 5. Self-Hosted Local Audio Transcription (`/whisper`)
* **Privacy & Speed**: Telegram voice notes are transcribed on-premise using an optimized local Whisper container, ensuring zero data leakage and instant responses.

---

## 💡 Why a Unified Stack (Instead of a Traditional Fork)?

Rather than maintaining a raw, coupled Git fork of an upstream repository, this project was architected as a **Unified Production Stack (Monorepo)** for several strategic reasons:

1. **Holistic System Ownership**:
   * A real-world AI deployment requires more than an agent loop; it needs a web dashboard (`/ui`), reverse proxy SSL (`/traefik`), infrastructure automation (`/infra`), background microservices (`/whisper`), and persistent storage. Consolidating these into a single repository provides complete operational reproducibility.
2. **Decoupled Upstream Tracking**:
   * The core engine (`nanoclaw/`) remains modularly separated from the custom web interface and infrastructure playbooks, allowing updates to be merged cleanly while maintaining custom native providers.
3. **Turnkey Infrastructure as Code**:
   * Cloning this single repository gives an engineer everything needed to spin up the entire multi-bot ecosystem on any Linux server with a single command.

---

## 🛠️ Quick Start & Deployment

### Prerequisites
* Linux (Ubuntu 22.04+ / Debian 12 recommended)
* Docker & Docker Compose
* Node.js / Bun runtime

### Step-by-Step Server Setup

```bash
# 1. Start the automated SSL Reverse Proxy (Traefik)
cd traefik
docker compose up -d

# 2. Start the Whisper transcription microservice
cd ../whisper
docker compose up -d

# 3. Run the Web Dashboard
cd ../ui
bun install
bun run src/index.ts

# 4. Start the NanoClaw Agent Engine
cd ../nanoclaw
pnpm install
pnpm build
pnpm start
```

### Systemd Production Services

```bash
# Check status of the stack services
systemctl status nanoclaw nanoclaw-uai
```

---

## 🔒 Security & Privacy

* **Zero-Secret Tracking**: All `.env` files, API keys, OAuth tokens (`google_tokens.json`), certificates (`acme.json`), and SQLite databases are strictly excluded via `.gitignore`.
* **Isolated Container Workspaces**: Each agent session runs in an isolated ephemeral Docker container with strictly scoped filesystem mounts.

---

## 📄 License

MIT License. Designed and engineered for scalable multi-agent AI deployments.
