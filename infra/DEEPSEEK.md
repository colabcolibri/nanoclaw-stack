# 🧠 Native DeepSeek Connector

This document describes the direct native integration with the DeepSeek API.

---

## 1. Connector Overview

Unlike heavyweight wrappers (such as OpenCode or OneCLI), NanoClaw's **`deepseek`** provider was built to communicate directly over HTTPS with the DeepSeek API:

* **Host Code:** [`src/providers/deepseek.ts`](file:///opt/nanoclaw-stack/nanoclaw/src/providers/deepseek.ts) (Reads environment variables and injects them into the container).
* **Container Code:** [`container/agent-runner/src/providers/deepseek.ts`](file:///opt/nanoclaw-stack/nanoclaw/container/agent-runner/src/providers/deepseek.ts) (Executes SSE streaming via native `fetch`).

---

## 2. Parameters & Configuration

| Environment Variable | Current Value | Description |
| :--- | :--- | :--- |
| `DEEPSEEK_API_KEY` | `sk-...` | Official DeepSeek authentication key. |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | Next-generation model (1M tokens context window). |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | Official API endpoint. |
| `DEEPSEEK_HISTORY_LIMIT` | `20` | Number of recent messages retained in immediate context history. |
| `NANOCLAW_AGENT_PROVIDER` | `deepseek` | Sets DeepSeek as the default agent provider. |

---

## 3. Context Management Workflow

1. **Rolling Window:**
   * The connector retains the latest `DEEPSEEK_HISTORY_LIMIT` messages in the session history (stored in JSON format in the `continuation` key).
   * When a new message arrives, it is appended to the queue and older messages are pruned from the API's immediate context window, keeping latency and costs low.

2. **Soul / Personality Injection:**
   * Before each prompt execution, the connector reads the bot directives file (e.g., [`groups/barao/instructions.prepend.md`](file:///opt/nanoclaw-stack/nanoclaw/groups/barao/instructions.prepend.md)) and injects it as a `system` message.
   * This ensures the model **never loses its identity or operational guidelines**, even after hundreds of exchanged messages.
