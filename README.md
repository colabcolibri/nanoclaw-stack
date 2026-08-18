# NanoClaw Personal Assistant Stack

> A modular, high-performance, and privacy-focused personal AI assistant ecosystem built on top of [NanoClaw](https://github.com/nanocoai/nanoclaw), designed to be model-agnostic, channel-agnostic, and self-hosted with zero vendor lock-in.

---

## 🧭 Overview

**NanoClaw Personal Assistant Stack** is an enterprise-grade, self-hosted deployment architecture that transforms the NanoClaw multi-agent runtime into a proactive, cost-efficient daily operational assistant.

Rather than coupling the system to a single AI vendor or chat app, this stack is architected around **modularity, extreme token efficiency, and autonomy**:
* **Two-Stage Pipeline & Fast-Path**: Direct 1-call conversational fast-path for 0-tool queries, and a lean two-stage loop (Stage 1 Action Engine + Stage 2 Executive Persona Synthesis) for complex tool tasks.
* **Semantic Message Memos & Scratchpad**: Context compression indexing past turns into compact memos (≤300 chars) with on-demand skill manuals (`load_skill`) and full context retrieval (`retrieve_message_context`), cutting token usage by up to 85%.
* **Model-Agnostic & Multi-Provider**: Pluggable provider system with dynamic UI switching across **Groq** (Llama 3.3, DeepSeek R1, GPT-OSS 120B/20B), **DeepSeek**, **OpenAI**, and **Claude**.
* **Zero-Cost Web Research & Native Tools**: Built-in zero-cost web search (`web_search`), page reader (`browse_url`), Google Workspace (Calendar & Gmail with token minimization), Notion, and Yampi e-commerce store.
* **Modern Control Panel & Token Ledger**: React + Tailwind + Vite web dashboard with real-time token ledger audit, sub-run inspector, i18n (pt-BR / en-US), dark/light theme, and 1-click OAuth integrations.
* **Self-Contained Edge Infrastructure**: Automated Let's Encrypt SSL edge routing (Traefik) and local voice note transcription (OpenAI Whisper ASR) in a single reproducible repository.

---

## ⚡ Key Architectural Adaptations

| Layer | Upstream NanoClaw | This Unified Stack |
| :--- | :--- | :--- |
| **Execution Engine** | Ad-hoc single-pass string parsing inside provider files. | **Two-Stage TurnOrchestrator**: Fast-Path for direct dialogue (1 call) + Stage 1 Technical Action Loop + Stage 2 Persona Synthesis with `ExecutionScratchpad` and `PayloadSanitizer`. |
| **Memory & Context** | Unbounded raw conversation accumulation (6,500+ tokens). | **Semantic Memos & Skills-on-Demand**: Bounded memo indices (~60–90 tokens) and dynamic skill loading (`load_skill`), saving up to 85% in API costs. |
| **Model Providers** | Hardcoded Claude CLI / STDIO MCP subprocesses. | **Dynamic Multi-Provider Hub**: Native connectors for Groq, DeepSeek, OpenAI, and Claude with isolated credentials and dynamic model pricing tables. |
| **Web Research** | Requires third-party paid API keys (Tavily/SerpAPI). | **Native Zero-Cost Web Engine**: Autonomous multi-engine search scraper + markdown content extractor with automatic link citation enforcement. |
| **Control & Ledger** | Terminal CLI and config files. | **Modern React Dashboard (`/ui/client`)**: Dark/light theme, i18n, live Sub-Run inspector, granular token accounting (prompt/completion/cost), and dynamic persona editor. |
| **Audio & Voice** | External cloud speech APIs. | **Local Audio Transcription (`/whisper`)**: Self-hosted OpenAI Whisper service for private, instant processing of voice notes across all channels. |
| **Edge Routing & SSL** | Manual reverse proxy setup. | **Traefik SSL Proxy (`/traefik`)**: Automated Let's Encrypt TLS certificate provisioning and secure routing. |

---

## 🏛️ System Architecture

```text
nanoclaw-stack/
├── nanoclaw/         # Core Multi-Agent Container Engine
│   ├── container/    # Ephemeral Docker runner, skills, orchestrator, and tools
│   │   ├── agent-runner/src/orchestrator/ # Two-Stage TurnOrchestrator & Scratchpad
│   │   ├── agent-runner/src/providers/    # BaseOpenAiProvider, Groq, DeepSeek, Claude
│   │   ├── agent-runner/src/services/     # MemoService, SkillsManager, TokenLedger
│   │   ├── agent-runner/src/tools/        # Native tools (Web Search, Gmail, Calendar, Notion, Yampi)
│   │   └── skills/                        # Skills manuals (agent-browser, notion-notes, yampi-store, etc.)
│   ├── docs/         # Architectural diagrams and execution workflows
│   └── src/          # Channel adapters (Telegram, macOS, CLI), SQLite state, message router
│
├── ui/               # Web Management Dashboard Backend (Bun + Hono + TypeScript)
│   ├── client/       # Modern React 19 + Tailwind CSS + Vite Frontend
│   │   ├── src/components/analytics/      # Token Ledger & Sub-Run Audit Sheet
│   │   ├── src/components/config/         # Provider selector, Keys, Location/Timezone
│   │   ├── src/components/soul/           # Persona & SOUL editor
│   │   └── src/locales/                   # i18n localization (en / pt)
│   └── src/          # API, OAuth callbacks, database services (Google, Notion, Yampi)
│
├── traefik/          # Automated SSL Edge Proxy (Docker + Let's Encrypt)
│   └── docker-compose.yml
│
├── whisper/          # Local Audio Transcription Service (OpenAI Whisper ASR)
│   └── docker-compose.yml
│
└── infra/            # Systemd service playbooks, architecture principles, and ops manuals
    ├── ARCHITECTURE_PHILOSOPHY.md # Satellite pattern & design principles
    ├── MACOS_INTEGRATION.md       # Apple Shortcuts, Siri, and macOS channel guide
    ├── DEEPSEEK.md                # Model connector & orchestrator specs
    ├── SERVICES.md                # Service topologies and port mappings
    └── MAINTENANCE.md             # Backup strategies and update workflows
```

---

## 🔄 Two-Stage Execution Workflow

```text
User Message (Text or Voice)
         │
         ▼
[Ingress & Whisper ASR] ──► [Generate Message Memo ≤300 chars]
         │
         ▼
[ToolRouter & Intent Gate]
   ├── [0 Tools Required] ──► [Fast-Path: 1 Single Call with SOUL Persona] ──► Output
   │
   └── [Tools Required]
             │
             ▼
      [STAGE 1: Lean Action Loop (~300 tokens / iter)]
         ├── load_skill (on-demand manual loading)
         ├── retrieve_message_context (on-demand deep history)
         ├── Native Tools (Gmail, Calendar, Notion, Yampi, Web Search)
         └── PayloadSanitizer ──► ExecutionScratchpad
             │
             ▼
      [STAGE 2: Executive Synthesis]
         ├── Injects Persona / SOUL Guidelines
         ├── Injects Memory Context & Temporal Anchors
         └── Compiles Scratchpad Findings ──► Clean Final Output
```

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

* **Zero-Secret Commits**: All credentials, OAuth tokens (`google_tokens.json`, `notion_tokens.json`, `yampi_tokens.json`), databases (`v2.db`), and `.env` files are strictly isolated locally and guarded by comprehensive `.gitignore` rules.
* **Sandboxed Execution**: Agent sessions run inside ephemeral, isolated Docker containers with strictly scoped filesystem boundaries.
* **Payload Hygiene**: The `PayloadSanitizer` automatically purges base64 blobs, raw HTML, and transport headers before persisting execution state.

---

## 📜 Credits & Acknowledgments

* Engine built upon [NanoClaw](https://github.com/nanocoai/nanoclaw) by Nanoco AI.
* Adapted and extended as an omnichannel, privacy-focused autonomous assistant platform.
