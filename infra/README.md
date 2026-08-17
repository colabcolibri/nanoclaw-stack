# 🏗️ INFRAESTRUTURA DO SISTEMA — NANOCLAW & BARÃO

Este diretório contém o registro detalhado de toda a infraestrutura, serviços, integrações e personalizações ativas no servidor.

---

## 🗺️ Visão Geral da Arquitetura

```
+-------------------------------------------------------------------------+
|                               TELEGRAM                                  |
|                 (Usuário @slbarao_bot / ID: 7239635872)                 |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                  HOST LINUX (Ubuntu / Debian - VPS)                     |
|                                                                         |
|  [nanoclaw.service] (Node 22 LTS / TSX)                                 |
|  ├── Canal: Telegram Long Polling (@chat-adapter/telegram)              |
|  ├── Central DB: SQLite (/opt/nanoclaw/data/v2.db)                      |
|  ├── Sessões: /opt/nanoclaw/data/v2-sessions/                           |
|  └── Router & Queue Engine                                              |
|                                                                         |
|  [whisper-asr.service] (Docker Compose / Local ASR)                     |
|  └── Container: whisper-asr (127.0.0.1:9000)                            |
|      - Transcrição local de voz/áudio .ogg do Telegram                  |
|      - Modelo: whisper-base (100% privado, custo $0)                    |
|                                                                         |
|  [Docker Runner]                                                        |
|  └── Container sob demanda: nanoclaw-agent-v2-3282970f:latest          |
|      ├── Provedor: deepseek (Nativo Direto via HTTPS)                   |
|      ├── Modelo: deepseek-v4-flash (1M Context Length)                  |
|      ├── Histórico: 20 mensagens (DEEPSEEK_HISTORY_LIMIT=20)             |
|      └── Soul / Persona: /workspace/group/instructions.prepend.md       |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                      DEEPSEEK API CLOUD DIRECT                          |
|             (https://api.deepseek.com/chat/completions)                 |
+-------------------------------------------------------------------------+
```

---

## 📂 Estrutura de Documentação

| Arquivo | Descrição |
| :--- | :--- |
| [**SERVICES.md**](file:///opt/infra/SERVICES.md) | Detalhes dos serviços `systemd`, portas, status e comandos de controle. |
| [**DEEPSEEK.md**](file:///opt/infra/DEEPSEEK.md) | Conector nativo direto, chaves, modelo e parâmetros de contexto. |
| [**WHISPER.md**](file:///opt/infra/WHISPER.md) | Serviço Docker local de transcrição de áudio e integração com o Telegram. |
| [**BARAO_SOUL.md**](file:///opt/infra/BARAO_SOUL.md) | Identidade, estilo, psicologia e diretrizes de comportamento do Barão. |
| [**MAINTENANCE.md**](file:///opt/infra/MAINTENANCE.md) | Procedimentos de reinicialização, leitura de logs, backups e atualizações Git. |

---

## 📌 Variáveis de Ambiente Ativas (`/opt/nanoclaw/.env`)

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_HISTORY_LIMIT=20
NANOCLAW_AGENT_PROVIDER=deepseek
NANOCLAW_AGENT_NAME=Barão
NANOCLAW_DISPLAY_NAME=Sergio
```
