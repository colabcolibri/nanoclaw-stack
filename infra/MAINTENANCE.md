# 🛠️ GUIA DE MANUTENÇÃO, ATUALIZAÇÕES E BACKUP

Este guia fornece os comandos essenciais para manutenção diária e atualizações seguras da infraestrutura.

---

## 1. Comandos do Dia a Dia

### Status dos Serviços:
```bash
systemctl status nanoclaw.service
systemctl status whisper-asr.service
```

### Reiniciar Serviços:
```bash
# Reiniciar o NanoClaw (Telegram / Barão)
systemctl restart nanoclaw.service

# Reiniciar o Whisper Local (Áudio / Voz)
systemctl restart whisper-asr.service
```

### Visualizar Logs em Tempo Real:
```bash
# Logs do assistente e mensagens do Telegram
journalctl -u nanoclaw.service -f

# Logs do Whisper
docker logs whisper-asr -f --tail 30
```

---

## 2. Como Atualizar pelo Git com Segurança

A infraestrutura foi desenhada para que os seus dados, configurações e adaptadores fiquem completamente isolados do repositório base:

* **O que é protegido e nunca é sobrescrito:**
  * `.env` (Chaves de API e tokens)
  * `data/` (Bancos de dados SQLite e sessões)
  * `groups/` (Personalidade, alma e memórias do Barão)
  * `infra/` (Esta documentação)
  * `/opt/whisper-service/` (Serviço de voz local)

### Procedimento de Atualização:
```bash
cd /opt/nanoclaw
git pull
pnpm install
systemctl restart nanoclaw.service
```

---

## 3. Procedimento de Backup Recomendado

Para fazer um backup completo de todas as conversas, banco de dados, chaves e personalidade do Barão, basta arquivar as seguintes pastas:

```bash
tar -czvf /root/nanoclaw-backup-$(date +%F).tar.gz \
  /opt/nanoclaw/.env \
  /opt/nanoclaw/data \
  /opt/nanoclaw/groups \
  /opt/infra \
  /opt/whisper-service
```
