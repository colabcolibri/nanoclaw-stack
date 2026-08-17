# NanoClaw Web Management Dashboard (`/ui`)

> A modern, lightweight, and secure web control dashboard for the **NanoClaw Production Stack**, built with **Bun**, **Hono**, and **TypeScript**.

---

## 🌟 Key Features

1. **Multi-Agent & Fleet Management:** Live inspection and editing of agent personas (`instructions.prepend.md`), active skills, container limits, and memory files.
2. **1-Click Third-Party Integrations:**
   * **Google Workspace:** Automated OAuth2 flow for Multi-Calendar and Gmail token generation.
   * **Notion Integration:** 1-click token validation, database selection, and schema sync.
3. **Passwordless Secure Login (Email OTP):** Access protected via time-limited one-time passwords delivered via Resend API with HTTP-only session cookies.
4. **Real-time Observability:** Direct SQLite sync with `v2.db` showing active message histories, session counters, container run statistics, and systemd logs.
5. **Edge Ready:** Native integration with the Traefik SSL reverse proxy (`/traefik`) over Let's Encrypt HTTPS.

---

## 📂 Project Structure

```text
ui/
├── src/
│   ├── auth/          # OTP authentication service & cookie token manager
│   ├── routes/        # REST API endpoints (agents, integrations, chat, telemetry)
│   ├── services/      # SQLite sync, Google OAuth2, Notion API, and group management
│   ├── public/        # Responsive frontend SPA (HTML5, Vanilla CSS, JS)
│   ├── config.ts      # Environment configuration and path resolvers
│   └── index.ts       # Bun HTTP server entrypoint
├── package.json
└── README.md
```

---

## 🚀 Running Locally or in Production

```bash
# 1. Install dependencies
bun install

# 2. Configure environment
cp .env.example .env

# 3. Start the dashboard
bun run src/index.ts
```

Production service is managed via systemd: `systemctl status nanoclaw-uai`.
