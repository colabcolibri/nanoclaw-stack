# ⚙️ System Services & Daemon Topology

This document describes the services managed by `systemd` and the active Docker container topologies.

---

## 1. Primary Engine Service: `nanoclaw.service`

* **Unit File:** `/etc/systemd/system/nanoclaw.service`
* **Working Directory:** `/opt/nanoclaw-stack/nanoclaw` (or `/opt/nanoclaw`)
* **Executable:** `node_modules/.bin/tsx src/index.ts`
* **Internal Ports & Sockets:**
  * `3000` (Webhook Server / Local API)
  * Unix Sockets: `data/cli.sock`, `data/ncl.sock`
* **Role & Responsibility:**
  * Manages the Telegram channel via Long Polling.
  * Handles message queuing and manages SQLite sessions in `data/v2-sessions/`.
  * Spawns and manages on-demand Docker execution containers for configured agent groups.

### Useful Commands:
```bash
# Check service status
systemctl status nanoclaw.service

# Restart service
systemctl restart nanoclaw.service

# Follow logs in real-time
journalctl -u nanoclaw.service -f

# Inspect the last 50 log lines
journalctl -u nanoclaw.service -n 50 --no-pager
```

---

## 2. Audio & Speech Transcription Service: `whisper-asr.service`

* **Unit File:** `/etc/systemd/system/whisper-asr.service`
* **Working Directory:** `/opt/nanoclaw-stack/whisper` (or `/opt/whisper-service`)
* **Orchestration:** Docker Compose
* **Container Name:** `whisper-asr`
* **Port:** `127.0.0.1:9000` (Localhost only, 100% private)
* **Image:** `onerahmet/openai-whisper-asr-webservice:latest`
* **Configuration:** `ASR_MODEL=base`, `ASR_ENGINE=openai_whisper`
* **Role & Responsibility:** Receives incoming `.ogg` audio notes from chat channels and transcribes them to text in milliseconds with zero external API costs.

### Useful Commands:
```bash
# Check service status
systemctl status whisper-asr.service

# Restart service
systemctl restart whisper-asr.service

# Follow container logs
docker logs whisper-asr --tail 30 -f

# Test transcription via curl
curl -s -X POST "http://127.0.0.1:9000/asr?task=transcribe&language=pt&output=txt" \
  -H "accept: text/plain" \
  -F "audio_file=@/path/to/audio.ogg"
```

---

## 3. Ephemeral Agent Container: `nanoclaw-agent-v2-*:latest`

* **Execution:** On-demand (the host runtime spawns the container when a message arrives and tears it down after execution completes).
* **Key Mounts:**
  * `/workspace/group` -> Host agent group storage (`nanoclaw/groups/<bot_name>/`)
  * `/workspace/agent` -> Host session storage (`nanoclaw/data/v2-sessions/<session_id>/`)
  * `/app/src` -> Modular container runner (`nanoclaw/container/agent-runner/src`)
* **Internal Runtime:** `bun /app/src/index.ts`
