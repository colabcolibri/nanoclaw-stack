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
│   └── src/          # Channel adapters (Telegram, macOS, CLI), SQLite state, message router
│
├── ui/               # Web Management Dashboard Backend (Bun + TypeScript)
│   ├── client/       # Modern React 19 + Tailwind CSS + Vite Frontend
│   │   ├── src/components/analytics/      # Token Ledger & Sub-Run Audit Sheet
│   │   ├── src/components/config/         # Provider selector, Keys, Location/Timezone
│   │   ├── src/components/soul/           # Persona & SOUL editor
│   │   └── src/locales/                   # i18n localization (en / pt)
│   └── src/          # API, OAuth callbacks, database services (Google, Notion, Yampi)
│
├── clients/macos/    # App nativo "Barão" (SwiftUI) — canal dedicado com Keychain
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
    ├── MAINTENANCE.md             # Backup strategies and update workflows
    ├── scripts/                   # deploy-stack.sh, ensure-docker.sh, build-agent-image-if-needed.sh
    └── systemd/                   # Reference unit files (nanoclaw + nanoclaw-uai)

docs/                 # Operator guides (index: docs/README.md)
├── README.md           # Índice geral de toda a documentação
├── DEV-LOCAL.md        # Mac dev: UI, motor, when Docker is required
├── DEPLOY.md           # Production deploy: push + SSH (Hostinger)
├── agents-and-skills.md # Como registrar agente/skill/tool/departamento
└── agent-turn-flow.md  # O turno ponta a ponta
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
[Orchestrator Triage (LLM)]
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

> **Dev:** `pnpm ai` · `pnpm dev` · **Deploy:** `pnpm deploy` — [docs/DEV-LOCAL.md](docs/DEV-LOCAL.md)

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

**Segredos:** `.env`, `groups/` e `data/` ficam só na máquina/servidor (`.gitignore`). Nada de API keys no git.

---

## 🔒 Privacy & Security

* **Zero-Secret Commits**: credentials, OAuth tokens, databases, and `.env` files stay local (`.gitignore`). Deploy is `./scripts/deploy.sh` from your Mac — no secrets in the repository.
* **Sandboxed Execution**: Agent sessions run inside ephemeral Docker containers (`cap-drop=ALL`, no-new-privileges, non-root) with strictly scoped filesystem boundaries and read-only mounts for engine code/registry.
* **Hardened Dashboard Auth**: e-mail OTP com `crypto.randomInt`, rate limit duplo (app + Traefik) nas rotas de autenticação, cookie `HttpOnly + Secure + SameSite` e **sessões revogáveis server-side** (logout invalida de verdade).
* **CSRF-safe OAuth**: fluxo Google com `state` assinado HMAC (nonce + expiração); todos os tokens de integração gravados com permissão `0600`; sanitização universal de pasta de grupo contra path traversal.
* **Payload Hygiene**: The `PayloadSanitizer` automatically purges base64 blobs, raw HTML, and transport headers before persisting execution state.

---

## ✅ Qualidade & CI

CI roda a cada PR (`.github/workflows/ci.yml`) em 4 frentes: motor host (typecheck + lint + **1086 testes**), agent-runner Bun (**250 testes**), backend da UI (typecheck + testes) e frontend (lint + build). Dependabot semanal nos 4 workspaces. O registry de agentes/skills é validado fail-loud no boot do container **e** no CI — registro errado quebra o build, nunca a produção.

---

## 📚 Documentação

| Guia | Conteúdo |
| :--- | :--- |
| [docs/README.md](docs/README.md) | **Índice geral** — toda a documentação por audiência |
| [docs/DEV-LOCAL.md](docs/DEV-LOCAL.md) | Rodar UI e motor no Mac; quando precisa de Docker |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Deploy em produção: `./scripts/deploy.sh` (push + SSH) |
| [docs/agents-and-skills.md](docs/agents-and-skills.md) | Como registrar agente, skill, tool ou departamento novo |
| [nanoclaw/docs/README.md](nanoclaw/docs/README.md) | Documentação interna do motor (17 docs) |

**Segredos:** `.env`, `groups/` e `data/` ficam só na máquina/servidor (`.gitignore`). Nada de API keys no git.

---

## 📜 Credits & Acknowledgments

* Engine built upon [NanoClaw](https://github.com/nanocoai/nanoclaw) by Nanoco AI.
* Adapted and extended as an omnichannel, privacy-focused autonomous assistant platform.
