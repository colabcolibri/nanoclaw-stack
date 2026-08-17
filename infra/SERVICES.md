# ⚙️ SERVIÇOS DO SISTEMA

Este documento descreve os serviços gerenciados pelo `systemd` e containers Docker ativos.

---

## 1. Serviço Principal: `nanoclaw.service`

* **Arquivo de Unidade:** `/etc/systemd/system/nanoclaw.service`
* **Diretório de Trabalho:** `/opt/nanoclaw`
* **Executável:** `/opt/nanoclaw/node_modules/.bin/tsx src/index.ts`
* **Portas Internas:**
  * `3000` (Webhook Server / API Local)
  * Sockets Unix: `/opt/nanoclaw/data/cli.sock`, `/opt/nanoclaw/data/ncl.sock`
* **Função:**
  * Gerencia o canal do Telegram via Long Polling (`@slbarao_bot`).
  * Processa a fila de mensagens e gerencia as sessões SQLite em `data/v2-sessions/`.
  * Cria e acorda containers Docker sob demanda para o grupo **Barão**.

### Comandos Úteis:
```bash
# Verificar status
systemctl status nanoclaw.service

# Reiniciar serviço
systemctl restart nanoclaw.service

# Ver logs em tempo real
journalctl -u nanoclaw.service -f

# Ver últimas 50 linhas de log
journalctl -u nanoclaw.service -n 50 --no-pager
```

---

## 2. Serviço de Áudio / Voz: `whisper-asr.service`

* **Arquivo de Unidade:** `/etc/systemd/system/whisper-asr.service`
* **Diretório de Trabalho:** `/opt/whisper-service`
* **Orquestração:** Docker Compose (`/opt/whisper-service/docker-compose.yml`)
* **Container Name:** `whisper-asr`
* **Porta:** `127.0.0.1:9000` (Apenas localhost, 100% privado)
* **Imagem:** `onerahmet/openai-whisper-asr-webservice:latest`
* **Configuração:** `ASR_MODEL=base`, `ASR_ENGINE=openai_whisper`
* **Função:** Recebe áudios `.ogg` enviados pelo Telegram e transcreve para texto em milissegundos sem custos de API.

### Comandos Úteis:
```bash
# Verificar status
systemctl status whisper-asr.service

# Reiniciar serviço
systemctl restart whisper-asr.service

# Logs do container
docker logs whisper-asr --tail 30 -f

# Testar transcrição via curl
curl -s -X POST "http://127.0.0.1:9000/asr?task=transcribe&language=pt&output=txt" \
  -H "accept: text/plain" \
  -F "audio_file=@/caminho/do/audio.ogg"
```

---

## 3. Container do Agente: `nanoclaw-agent-v2-3282970f:latest`

* **Execução:** Sob demanda (o host inicia o container quando chega mensagem e o encerra após o processamento).
* **Montagens principais:**
  * `/workspace/group` -> `/opt/nanoclaw/groups/barao/`
  * `/workspace/agent` -> `/opt/nanoclaw/data/v2-sessions/<session_id>/`
  * `/app/src` -> `/opt/nanoclaw/container/agent-runner/src`
* **Executável interno:** `bun /app/src/index.ts`
