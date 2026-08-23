# desenvolvimento local e deploy

Guia rápido para rodar o stack no Mac, saber quando o Docker é obrigatório e publicar no servidor **sem Mutagen** (só git + SSH).

---

## comandos (raiz do repo)

```bash
pnpm ai              # IA (motor + agente) — bot/Telegram
pnpm dev             # painel + IA — http://localhost:5080
pnpm build:agent     # build imagem Docker (1ª vez)
pnpm deploy          # produção (push + servidor)
```

Atalhos equivalentes: `./ai`, `./dev`

**Build da imagem Docker** (uma vez, ou quando `bun.lock` do agente mudar): `pnpm build:agent`

Pré-requisitos: Docker Desktop ligado, **Node 22** (motor), `ui/.env` e `nanoclaw/.env` (ver abaixo).

O motor usa `better-sqlite3`, que não compila no Node 26. Os scripts `pnpm dev` / `pnpm ai` já preferem `node@22` do Homebrew se instalado (`brew install node@22`).

Fluxo do agente (turn, memos, orquestrador): [agent-turn-flow.md](agent-turn-flow.md).

---

## o que roda onde

| componente | pasta | porta | precisa de docker? |
| :--- | :--- | :--- | :--- |
| painel (UI) | `ui/` | 5080 (`VITE_DEV_PORT`) | não |
| API UI (Bun) | `ui/` | 5081 (`PORT`) | não |
| motor (host) | `nanoclaw/` | 5082 (`WEBHOOK_PORT`) | não (processo Node) |
| agent-runner (por mensagem) | `nanoclaw/container/` | — | **sim** — um container por turno |
| whisper / traefik | `whisper/`, `traefik/` | 9000, 80/443 | sim (opcional no dev) |

O motor sobe no host com `pnpm dev`. Quando chega uma mensagem (Telegram, macOS channel, etc.), o host chama `docker run` para executar o agent-runner. Sem Docker Desktop ligado, o painel e o motor sobem, mas **respostas do agente falham**.

---

## cenários de desenvolvimento

### 1. só painel (UI, analytics, config, layout)

```bash
cd ui
bun install
cd client && bun install && cd ..
bun run dev
```

Crie `ui/.env`:

```env
NANOCLAW_PATH=/caminho/absoluto/para/nanoclaw/nanoclaw
NANOCLAW_DEFAULT_GROUP=barao
UI_PUBLIC_URL=http://localhost:5080
ALLOWED_EMAIL=seu@email.com
RESEND_API_KEY=re_...
FROM_EMAIL=NanoClaw UI <seu@email.com>
SESSION_SECRET=um_secret_aleatorio
PORT=5081
VITE_DEV_PORT=5080
NANOCLAW_MOTOR_URL=http://127.0.0.1:5082
```

O login OTP chega por email (Resend). Digite o código na segunda tela do login.

### 2. motor + agente (Telegram, testes de ponta a ponta)

Pré-requisitos:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e **rodando**
- imagem do agente buildada uma vez:

```bash
cd nanoclaw
pnpm install
./container/build.sh
pnpm dev
```

### 3. stack completa local (painel + motor)

Dois terminais, Docker Desktop ligado:

```bash
# terminal 1 — motor
cd nanoclaw && pnpm dev

# terminal 2 — painel
cd ui && bun run dev
```

No `ui/`, use **só bun** (não misture `pnpm install` no `ui/` — gera warnings de pacotes ignorados).

Se a porta da API (5081) estiver ocupada por um processo antigo:

```bash
lsof -ti :5081 | xargs kill
```

---

## variáveis importantes

| arquivo | variável | uso |
| :--- | :--- | :--- |
| `ui/.env` | `NANOCLAW_PATH` | caminho do checkout `nanoclaw/` (local ou `/opt/nanoclaw-stack/nanoclaw` no servidor) |
| `ui/.env` | `NANOCLAW_DEFAULT_GROUP` | pasta do agente em `groups/` (ex.: `barao`) |
| `ui/.env` | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google (painel → MCPs → Conectar conta) |
| `ui/.env` | `UI_PUBLIC_URL` | URL pública do painel (dev: `http://localhost:5080`) — **deve bater** com o redirect URI no Google Cloud Console |

### Google OAuth no localhost (`redirect_uri_mismatch`)

1. Em `ui/.env`, confirme `UI_PUBLIC_URL=http://localhost:5080` (sem barra no final).
2. No [Google Cloud Console](https://console.cloud.google.com/) → **APIs e serviços** → **Credenciais** → seu cliente OAuth (tipo **Aplicativo da Web**).
3. Em **URIs de redirecionamento autorizados**, adicione exatamente:
   ```
   http://localhost:5080/api/integrations/google/callback
   ```
4. Salve e aguarde ~1 minuto. Reinicie o painel (`bun run dev` no `ui/`) e tente **Conectar conta Google** de novo.

O redirect usa `UI_PUBLIC_URL` + `/api/integrations/google/callback`. Se o erro persistir, compare caractere a caractere com o URI cadastrado no Console (http vs https, porta, sem path extra).

| `ui/.env` | `ALLOWED_EMAIL` | email autorizado no login OTP |
| `ui/.env` | `PORT` | API Bun em dev (padrão `5081`) |
| `ui/.env` | `NANOCLAW_MOTOR_URL` | URL do motor Node (padrão `http://127.0.0.1:5082`) — **obrigatório** |
| `ui/.env` | `VITE_DEV_PORT` | porta do painel em dev (padrão `5080`) |
| `nanoclaw/.env` | `WEBHOOK_PORT` | porta do motor (padrão `5082`) |
| `nanoclaw/.env` | `UI_PUBLIC_URL` | mesma URL do painel — injetada no container do agente (mensagens de erro) |
| `nanoclaw/.env` | chaves de provider, tokens de canal | motor e agent-runner |

**Importante (Telegram):** nunca rode o motor local e o `nanoclaw.service` no servidor com o **mesmo** `TELEGRAM_BOT_TOKEN`. Um token só pode ter um long-polling ativo — o outro processo recebe `Conflict: terminated by other getUpdates request`.

Arquivos locais **nunca vão pro git**: `.env`, `data/`, `groups/`, tokens OAuth.

---

## deploy no servidor

Guia completo: [docs/DEPLOY.md](DEPLOY.md)

```bash
./scripts/deploy.sh
```

```bash
SKIP_PUSH=1 ./scripts/deploy.sh
DEPLOY_HOST=hostinger ./scripts/deploy.sh
```

No servidor, `deploy-stack.sh` faz: `git pull` → deps → build UI → rebuild imagem do agente (se precisar) → restart.

---

## produção vs local

| | local (Mac) | servidor (Hostinger) |
| :--- | :--- | :--- |
| UI | `bun run dev` | `nanoclaw-uai.service` |
| motor | `pnpm dev` | `nanoclaw.service` |
| agent-runner | Docker Desktop | Docker Engine |
| deploy | `./scripts/deploy.sh` | mesmo script via SSH |

---

## referências

- [infra/MAINTENANCE.md](../infra/MAINTENANCE.md) — backup, logs, update no servidor
- [infra/SERVICES.md](../infra/SERVICES.md) — portas e systemd
- [nanoclaw/docs/build-and-runtime.md](../nanoclaw/docs/build-and-runtime.md) — build da imagem do agente
