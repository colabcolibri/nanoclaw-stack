# 🛠️ Maintenance, Updates & Backup Guide

This guide provides essential commands for day-to-day maintenance, service monitoring, and safe infrastructure updates.

---

## 1. Daily Operations & Service Management

### Service Status:
```bash
systemctl status nanoclaw.service
systemctl status whisper-asr.service
```

### Restarting Services:
```bash
# Restart the NanoClaw engine
systemctl restart nanoclaw.service

# Restart the local Whisper speech transcription service
systemctl restart whisper-asr.service
```

### Viewing Logs in Real Time:
```bash
# NanoClaw engine logs
journalctl -u nanoclaw.service -f

# Whisper ASR container logs
docker logs whisper-asr -f --tail 30
```

---

## 2. Safe Git Update Procedures

> Desenvolvimento local: [docs/DEV-LOCAL.md](../docs/DEV-LOCAL.md) · Deploy automático: [docs/DEPLOY.md](../docs/DEPLOY.md)

The infrastructure is designed so that your local configurations, state databases, and agent definitions are completely isolated from upstream repository updates:

* **Protected Local Paths (Excluded from Git / Never Overwritten):**
  * `.env` (API keys, web secrets, tokens)
  * `data/` (SQLite databases, session histories, CLI sockets)
  * `groups/` (Agent personality directives, instructions, memories)
  * `infra/` (Operational playbooks)
  * Local auxiliary services

### Update Procedure (stack completo em `/opt/nanoclaw-stack`):

**Automático:** push em `main` dispara GitHub Actions → SSH → `deploy-stack.sh`. Ver [docs/DEPLOY.md](../docs/DEPLOY.md).

**Manual:**

```bash
# No Mac (após commit local):
./scripts/deploy.sh

# Ou manualmente no servidor:
cd /opt/nanoclaw-stack
bash infra/scripts/deploy-stack.sh
```

O script no servidor faz `git reset --hard origin/main` (código = GitHub). Dados locais (`.env`, `data/`, `groups/`) não são tocados.

### Componentes (se precisar só de um):

```bash
# Só motor
cd /opt/nanoclaw-stack/nanoclaw
pnpm install
systemctl restart nanoclaw.service

# Só painel (com rebuild do client)
cd /opt/nanoclaw-stack/ui/client && bun run build
systemctl restart nanoclaw-uai.service
```

---

## 3. Recommended Backup Procedure

To perform a complete backup of all conversation history, databases, API keys, and agent memories, archive the local state directories:

```bash
tar -czvf /root/nanoclaw-backup-$(date +%F).tar.gz \
  /opt/nanoclaw-stack/nanoclaw/.env \
  /opt/nanoclaw-stack/nanoclaw/data \
  /opt/nanoclaw-stack/nanoclaw/groups \
  /opt/nanoclaw-stack/ui/.env \
  /opt/nanoclaw-stack/infra \
  /opt/nanoclaw-stack/whisper
```

