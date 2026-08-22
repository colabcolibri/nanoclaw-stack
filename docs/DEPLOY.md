# deploy em produção

Um comando do Mac atualiza o servidor. GitHub é só o repositório — sem Actions, sem secrets, sem runner.

---

## fluxo (use isso)

```bash
# na raiz do repo, após commit:
./scripts/deploy.sh
```

Isso faz:

```text
git push origin main
    → ssh hostinger
    → bash /opt/nanoclaw-stack/infra/scripts/deploy-stack.sh
```

Opções:

```bash
SKIP_PUSH=1 ./scripts/deploy.sh     # push já feito
DEPLOY_HOST=hostinger ./scripts/deploy.sh   # host do ~/.ssh/config (padrão)
```

Só no servidor (sem Mac):

```bash
ssh hostinger 'bash /opt/nanoclaw-stack/infra/scripts/deploy-stack.sh'
```

---

## o que o deploy faz no servidor

```text
deploy-stack.sh
  ├─ ensure-docker.sh                 → Docker ativo
  ├─ git fetch + reset --hard main  → código = GitHub
  ├─ pnpm install (nanoclaw/)       → deps do motor (rápido se nada mudou)
  ├─ build-agent-image-if-needed.sh → imagem Docker do agente (só se bun.lock mudou)
  ├─ bun build (ui/client)          → painel React
  └─ systemctl restart              → nanoclaw + nanoclaw-uai
```

**Não é reinstalar tudo.** Na maioria dos deploys: código novo + restart + build do painel.

---

## o que roda onde (por que não é “só docker compose”)

| peça | onde roda | no deploy |
| :--- | :--- | :--- |
| **motor** (`nanoclaw`) | host (systemd) | `git pull` + restart |
| **painel** (`ui`) | host (systemd) | `bun build` + restart |
| **agente** (por mensagem) | container Docker efêmero | código via bind-mount; rebuild de imagem raro |
| whisper / traefik | Docker Compose | quase nunca no deploy do app |

O motor **fica no host** por design do NanoClaw (Telegram, SQLite central, spawn de containers). Só a execução do agente é Docker.

---

## docker no servidor

| componente | papel |
| :--- | :--- |
| `docker.service` | deve estar `active` no boot |
| `nanoclaw.service` | `Requires=docker.service` |
| imagem do agente | `nanoclaw-agent-v2-<slug>:latest` |

Rebuild forçado da imagem:

```bash
DEPLOY_FORCE_AGENT_BUILD=1 bash /opt/nanoclaw-stack/infra/scripts/build-agent-image-if-needed.sh
```

---

## dados que o deploy nunca apaga

- `nanoclaw/.env`, `ui/.env`
- `nanoclaw/data/`, `nanoclaw/groups/`

---

## troubleshooting

```bash
# deploy manual no servidor
cd /opt/nanoclaw-stack && bash infra/scripts/deploy-stack.sh

# motor
journalctl -u nanoclaw.service -f

# docker
docker info && docker images | grep nanoclaw-agent
```

| problema | solução |
| :--- | :--- |
| `ssh: Could not resolve hostname` | configure `Host hostinger` em `~/.ssh/config` ou use `DEPLOY_HOST=ip` |
| agente não responde | `systemctl status docker` + imagem existe? |
| painel antigo | conferir bundle em `ui/src/public/index.html` após deploy |
