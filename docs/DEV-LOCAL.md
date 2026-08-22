# desenvolvimento local e deploy

Guia rápido para rodar o stack no Mac, saber quando o Docker é obrigatório e publicar no servidor **sem Mutagen** (só git + SSH).

---

## comandos (raiz do repo)

```bash
pnpm ai              # IA (motor + agente) — bot/Telegram
pnpm dev             # painel + IA — http://localhost:3080
pnpm build:agent     # build imagem Docker (1ª vez)
pnpm deploy          # produção (push + servidor)
```

Atalhos equivalentes: `./ai`, `./dev`

**Build da imagem Docker** (uma vez, ou quando `bun.lock` do agente mudar): `pnpm build:agent`

Pré-requisitos: Docker Desktop ligado, `ui/.env` e `nanoclaw/.env` (ver abaixo).

---

## o que roda onde

| componente | pasta | porta | precisa de docker? |
| :--- | :--- | :--- | :--- |
| painel (UI) | `ui/` | 3001 | não |
| motor (host) | `nanoclaw/` | 3000 | não (processo Node) |
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
ALLOWED_EMAIL=seu@email.com
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

Se a porta 3001 estiver ocupada por um processo antigo:

```bash
lsof -ti :3001 | xargs kill
```

---

## variáveis importantes

| arquivo | variável | uso |
| :--- | :--- | :--- |
| `ui/.env` | `NANOCLAW_PATH` | caminho do checkout `nanoclaw/` (local ou `/opt/nanoclaw-stack/nanoclaw` no servidor) |
| `ui/.env` | `ALLOWED_EMAIL` | email autorizado no login OTP |
| `ui/.env` | `VITE_DEV_PORT` | porta do painel em dev (padrão `3080`) |
| `nanoclaw/.env` | chaves de provider, tokens de canal | motor e agent-runner |

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
