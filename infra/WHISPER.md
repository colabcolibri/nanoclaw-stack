# 🎙️ TRANSCRIÇÃO DE ÁUDIO & VOZ (LOCAL WHISPER)

Este documento detalha o sistema de processamento e transcrição de áudios locais.

---

## 1. Arquitetura do Whisper Local

Para evitar custos por minuto com a API da OpenAI e garantir 100% de privacidade dos seus áudios, o NanoClaw utiliza um container dedicado do **OpenAI Whisper ASR**:

* **Localização:** `/opt/whisper-service/`
* **Porta:** `127.0.0.1:9000`
* **Modelo Atual:** `base` (multilíngue, com suporte de alta fidelidade ao Português Brasileiro).
* **Motor:** `openai_whisper` (Python + PyTorch otimizado para CPU).

---

## 2. Fluxo de Transcrição do Telegram

```
[Usuário envia áudio no Telegram]
               │
               ▼
[Telegram Adapter do NanoClaw recebe o payload de áudio .ogg]
               │
               ▼
[Bridge do Chat SDK baixa o arquivo binário]
               │
               ▼
[POST http://127.0.0.1:9000/asr?task=transcribe&language=pt&output=txt]
               │
               ▼
[Whisper processa o áudio em ~1 segundo e retorna o texto transcrito]
               │
               ▼
[NanoClaw formata como: 🎤 [Áudio transcrito]: "Texto aqui"]
               │
               ▼
[DeepSeek (Barão) processa e envia a resposta para o Telegram]
```

---

## 3. Configurações e Modelos Disponíveis

Se desejar alterar o modelo do Whisper no futuro (para maior precisão ou menor consumo de memória), edite `/opt/whisper-service/docker-compose.yml`:

* `tiny`: Ultra rápido (~200ms), 39M parâmetros, menor acurácia.
* `base` (Atual): Ótimo equilíbrio (~1s), 74M parâmetros, excelente para conversação.
* `small`: Maior precisão (~2.5s), 244M parâmetros.
* `medium`: Precisão avançada (~6s), 769M parâmetros.

Após alterar, reinicie o serviço com:
```bash
systemctl restart whisper-asr.service
```
