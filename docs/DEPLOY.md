# deploy em produção (Hostinger)

Como o código chega no servidor, como o Docker entra no fluxo e o que configurar no GitHub.

---

## fluxo automático (jeito certo)

```text
Você faz push em main
        │
        ▼
GitHub Actions (.github/workflows/deploy-production.yml)
        │
        │  SSH no Hostinger
        ▼
infra/scripts/deploy-stack.sh
        ├─ ensure-docker.sh      → docker ativo
        ├─ git reset --hard      → código = origin/main
        ├─ pnpm install          → motor
        ├─ build-agent-image-if-needed.sh → imagem Docker do agente (se bun.lock mudou)
        ├─ bun build             → painel React
        └─ systemctl restart     → nanoclaw + nanoclaw-uai
```

O GitHub **não copia arquivos** sozinho. O workflow **entra no servidor por SSH** e roda o script de deploy, que faz `git pull` (via `reset --hard`) e rebuild.

---

## configurar GitHub (uma vez)

No repositório, vá em **Settings → Secrets and variables → Actions** e crie os secrets abaixo.  
**Nunca** coloque IP, chave SSH ou API keys em arquivos do repositório — só nos secrets do GitHub.

| secret | valor |
| :--- | :--- |
| `DEPLOY_HOST` | IP ou hostname do VPS (ex.: `123.45.67.89`) |
| `DEPLOY_USER` | `root` (ou usuário com sudo/systemctl) |
| `DEPLOY_SSH_KEY` | chave privada SSH (conteúdo do arquivo, não o caminho) |
| `DEPLOY_SSH_PORT` | opcional, padrão `22` |

### gerar chave só para deploy

No Mac:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/nanoclaw-deploy -N "" -C "github-actions-deploy"
cat ~/.ssh/nanoclaw-deploy.pub
```

No servidor, adicione a chave pública em `/root/.ssh/authorized_keys`.

Copie a chave **privada** (`~/.ssh/nanoclaw-deploy`) inteira para o secret `DEPLOY_SSH_KEY` no GitHub.

### testar manualmente (sem Actions)

```bash
# na raiz do repo
./scripts/deploy.sh
```

Isso faz `git push` + SSH + `deploy-stack.sh` — o mesmo script que o GitHub Actions executa.

---

## docker no Hostinger

| componente | como roda |
| :--- | :--- |
| `docker.service` | systemd, `enabled` no boot |
| `nanoclaw.service` | `Requires=docker.service` — motor só sobe se Docker OK |
| `whisper-asr`, `traefik` | containers Docker separados |
| agent-runner | imagem `nanoclaw-agent-v2-<slug>:latest`, spawnada por mensagem |

O código TypeScript do agente (`container/agent-runner/src`) é **bind-mount** no container — mudanças de código sobem no deploy sem rebuild. Rebuild da imagem só quando:

- `bun.lock` do agent-runner mudou
- imagem não existe
- `DEPLOY_FORCE_AGENT_BUILD=1`

Forçar rebuild no servidor:

```bash
DEPLOY_FORCE_AGENT_BUILD=1 bash /opt/nanoclaw-stack/infra/scripts/build-agent-image-if-needed.sh
```

Unit de referência: [infra/systemd/nanoclaw.service](../infra/systemd/nanoclaw.service)

---

## o que o servidor guarda fora do git

Nunca sobrescritos pelo deploy (`git reset --hard`):

- `nanoclaw/.env` — chaves e tokens
- `nanoclaw/data/` — SQLite e sessões
- `nanoclaw/groups/` — personas e memórias
- `ui/.env` — login do painel

---

## troubleshooting

```bash
# docker
systemctl status docker
docker info
docker images | grep nanoclaw-agent

# motor
journalctl -u nanoclaw.service -f

# deploy manual
cd /opt/nanoclaw-stack && bash infra/scripts/deploy-stack.sh

# último workflow
gh run list --workflow=deploy-production.yml
```
