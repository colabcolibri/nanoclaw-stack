# 🧠 Native LLM Provider & Turn Orchestrator

This document describes the native model connector architecture and the **`TurnOrchestrator`** execution engine that powers DeepSeek (and any future LLM providers) in the **NanoClaw Production Stack**.

---

## 1. Architectural Separation: Provider vs. Orchestrator

To avoid monolithic code coupling, execution is strictly decoupled into two layers:

1. **Provider Client (`providers/deepseek.ts`):** A lightweight (~60 lines) HTTP completion client that sends formatted prompts and returns raw tokens/tool calls.
2. **Turn Orchestrator (`orchestrator/turn-orchestrator.ts`):** A reusable engine that handles conversational lifecycle, tool execution loops, intermediate notifications, and response normalization.

```text
┌─────────────────────────────────────────────────────────────┐
│                    TurnOrchestrator                         │
│  - Pre-execution user feedback dispatch (Telegram/Channels) │
│  - Hybrid Tool Parser (Standard JSON + DSML/XML blocks)     │
│  - Tool Loop Safety & Concurrency Control                   │
│  - Guaranteed Human Closure Contract (Never leaves empty)   │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
     ┌───────────────────┐           ┌───────────────────┐
     │  DeepSeek Client  │           │   Native Tools    │
     │  (or OpenAI, etc) │           │ (Notion, Cal, Sys)│
     └───────────────────┘           └───────────────────┘
```

---

## 2. Parameters & Configuration

| Environment Variable | Default Value | Description |
| :--- | :--- | :--- |
| `DEEPSEEK_API_KEY` | `sk-...` | Official DeepSeek API authentication key. |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | Selected model (`deepseek-chat`, `deepseek-v4-flash`). |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | Official API endpoint URL. |
| `DEEPSEEK_HISTORY_LIMIT` | `50` | Number of recent messages retained in immediate context history. |
| `NANOCLAW_AGENT_PROVIDER` | `deepseek` | Sets the active default provider for the agent runner. |

---

## 3. Key Turn Execution Features

1. **Intermediate User Notifications:**
   * When an agent generates preliminary conversational text before executing a heavy tool (e.g. *"Vou consultar sua agenda agora..."*), the orchestrator dispatches this message immediately to the user without waiting for tool completion.

2. **Hybrid Tool Format Normalization (JSON + DSML):**
   * Automatically parses both structured OpenAI-style `tool_calls` and DeepSeek DSML tags (`<｜｜DSML｜｜invoke>`), strips technical artifacts, and returns clean results.

3. **Guaranteed Natural Language Closure:**
   * If a model executes a tool and returns without conversational text, the orchestrator triggers an automatic closure turn instructing the model to deliver a friendly, human confirmation in Portuguese.

4. **Rolling Context & Soul Injection:**
   * Dynamic injection of [`groups/<bot>/instructions.prepend.md`](file:///opt/nanoclaw-stack/nanoclaw/groups/barao/instructions.prepend.md) ensuring the persona is permanently anchored across long multi-turn sessions.
