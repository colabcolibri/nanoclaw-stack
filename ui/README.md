# NanoClaw Web Management Dashboard (`/ui`)

> Dashboard de controle do **NanoClaw Production Stack** — backend **Bun puro** (sem framework HTTP) + frontend **React 19 + Tailwind 4 + Vite**.

---

## 🌟 Key Features

1. **Multi-Agent & Fleet Management:** Live inspection and editing of agent personas (`instructions.prepend.md`), active skills, container limits, and memory files.
2. **1-Click Third-Party Integrations:**
   * **Google Workspace:** Automated OAuth2 flow (state assinado HMAC, anti-CSRF) for Multi-Calendar and Gmail token generation.
   * **Notion Integration:** 1-click token validation, database selection, and schema sync.
3. **Passwordless Secure Login (Email OTP):** códigos com `crypto.randomInt`, rate limit por IP, cookies `HttpOnly + Secure + SameSite` e **sessões revogáveis server-side** (tabela `ui_sessions` no DB central — logout invalida o token de verdade).
4. **Real-time Observability:** Direct SQLite sync with `v2.db` showing active message histories, session counters, container run statistics, and systemd logs.
5. **Edge Ready:** Native integration with the Traefik SSL reverse proxy (`/traefik`) over Let's Encrypt HTTPS — com rate limit dedicado às rotas `/api/auth/*`.

---

## 📂 Project Structure

```text
ui/
├── src/
│   ├── auth/          # OTP (crypto), rate limit, token HMAC + session store revogável
│   ├── routes/        # REST API endpoints (agents, integrations, chat, telemetry)
│   ├── services/      # SQLite sync, Google OAuth2, Notion API, and group management
│   ├── channels/      # Adaptador do canal macOS (chave timing-safe)
│   └── index.ts       # Bun HTTP server entrypoint
├── client/            # Frontend React 19 + Vite (ver client/DESIGN.md)
├── package.json
└── README.md
```

---

## 🚀 Running Locally or in Production

Guia completo (Docker, `NANOCLAW_PATH`, deploy): [docs/DEV-LOCAL.md](../docs/DEV-LOCAL.md)

```bash
# 1. Install dependencies
bun install

# 2. Configure environment
cp .env.example .env

# 3. Start the dashboard
bun run dev          # watch mode; ou bun run src/index.ts
```

Production service is managed via systemd: `systemctl status nanoclaw-uai` (unit de referência em `infra/systemd/nanoclaw-uai.service`).

## ✅ Qualidade

```bash
bunx tsc --noEmit    # typecheck estrito
bun test src         # 27 testes (serviços + rotas da API)
cd client && bun run lint && bun run build   # frontend
```
