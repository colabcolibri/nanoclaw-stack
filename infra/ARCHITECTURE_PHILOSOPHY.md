# Architecture Philosophy & Design Principles

> **Core Axiom:** Keep the agent engine pure and standard. Build all operational intelligence, user interfaces, media pipelines, and business tools as modular satellites around it.

---

## 🏛️ The Satellite Architecture Pattern

Upstream [NanoClaw](https://github.com/nanocoai/nanoclaw) is treated strictly as an **Execution Runtime Engine** (the kernel). Everything required to operate it as a daily, multi-bot personal assistant is built **around** it as decoupled, modular layers:

```text
       ┌───────────────────────────────────────────────────────────┐
       │                   Edge & Media Layer                      │
       │     [Traefik (Automated SSL)]   [Whisper ASR (Audio)]     │
       └─────────────────────────────┬─────────────────────────────┘
                                     │
       ┌─────────────────────────────▼─────────────────────────────┐
       │                 Control Surface Layer                     │
       │     [UI Web Dashboard] ──── (1-Click OAuth / Monitor)     │
       └─────────────────────────────┬─────────────────────────────┘
                                     │
       ┌─────────────────────────────▼─────────────────────────────┐
       │                    Core Runtime Engine                    │
       │     [NanoClaw Host] ──── (SQLite State, Channels, DMs)    │
       └─────────────────────────────┬─────────────────────────────┘
                                     │
       ┌─────────────────────────────▼─────────────────────────────┐
       │                 Modular Execution Layer                   │
       │     [Ephemeral Docker Sandbox] ──> [/tools (Native API)]  │
       │     (Google Calendar, Gmail, System Shell, Custom APIs)   │
       └───────────────────────────────────────────────────────────┘
```

---

## 🧭 Core Principles

### 1. Zero Core Pollution (Upstream Compatibility)
* **Rule:** Never introduce bespoke business logic, hardcoded tokens, or breaking modifications directly into the core NanoClaw runtime files.
* **Why:** When upstream releases performance improvements, bug fixes, or new channel adapters, the core can be rebased or updated without breaking custom dashboards or tools.

### 2. Composition Over Modification
* **Rule:** Add new capabilities through pluggable satellites (new modules in `nanoclaw/container/agent-runner/src/tools/`, new Docker services, or new UI endpoints).
* **Why:** Adding a new integration (e.g. Notion, WhatsApp, CRM) is as simple as dropping a new file in `/tools` and registering it in the barrel index, without altering agent loop lifecycles.

### 3. Native Function Calling Over Heavy Subprocesses
* **Rule:** Prefer native LLM function calling (`tools: [...]`) with direct HTTP calls over spawning heavy, external STDIO MCP subprocesses inside containers.
* **Why:** 
  * Eliminates fragile STDIO pipe handshakes.
  * Reduces container memory footprint and CPU spikes.
  * Cuts tool execution latency from seconds to milliseconds.
  * Transparently handles OAuth2 token lifecycles in background.

### 4. Multi-Bot Fleet Readiness
* **Rule:** The stack must never assume a single bot exists.
* **Why:** Each agent group in `nanoclaw/groups/<bot_name>/` has its own isolated memory (`memory/`), personality directives (`instructions.prepend.md`), and authorized credentials (`google_tokens.json`), while sharing the underlying runtime, UI, and audio infrastructure.

### 5. Local State & Privacy Preservation
* **Rule:** Keep secrets, SQLite databases, SSL certificates, and bot memories strictly local on the host server (`.gitignore`).
* **Why:** The codebase can be open-sourced or maintained publicly on GitHub without risk of credential exposure, while the host server retains full operational state.

### 6. Omnichannel Per-Channel Context Isolation
* **Rule:** Multi-channel endpoints (Telegram, macOS Shortcuts, Web, CLI) must maintain separate, dedicated SQLite sessions (`v2-sessions/<group>/sess-<channel>/`).
* **Why:** Prevents cross-device prompt bleeding and context pollution, ensuring interactions on a desktop MacBook and mobile Telegram operate as independent conversational threads while sharing the same underlying tools and databases.

