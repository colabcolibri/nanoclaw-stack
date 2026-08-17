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

The infrastructure is designed so that your local configurations, state databases, and agent definitions are completely isolated from upstream repository updates:

* **Protected Local Paths (Excluded from Git / Never Overwritten):**
  * `.env` (API keys, web secrets, tokens)
  * `data/` (SQLite databases, session histories, CLI sockets)
  * `groups/` (Agent personality directives, instructions, memories)
  * `infra/` (Operational playbooks)
  * Local auxiliary services

### Update Procedure:
```bash
cd /opt/nanoclaw-stack/nanoclaw
git pull
pnpm install
systemctl restart nanoclaw.service
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

