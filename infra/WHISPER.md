# 🎙️ Local Audio & Speech Transcription (Whisper ASR)

This document details the self-hosted audio transcription pipeline for chat voice messages.

---

## 1. Local Whisper Architecture

To eliminate per-minute third-party cloud API costs and ensure 100% privacy for voice messages, the stack utilizes a dedicated container running **OpenAI Whisper ASR**:

* **Location:** [`whisper/`](file:///opt/nanoclaw-stack/whisper/)
* **Port:** `127.0.0.1:9000`
* **Current Model:** `base` (multilingual, fast CPU inference, robust accuracy across languages).
* **Engine:** `openai_whisper` (Python + PyTorch optimized for CPU execution).

---

## 2. Audio Processing Flow

```text
[User sends voice note / .ogg via Telegram or Chat Adapter]
                        │
                        ▼
[Channel Adapter receives audio payload]
                        │
                        ▼
[Bridge downloads audio binary]
                        │
                        ▼
[POST http://127.0.0.1:9000/asr?task=transcribe&output=txt]
                        │
                        ▼
[Whisper processes audio in ~1s and returns transcribed text]
                        │
                        ▼
[NanoClaw formats as: 🎤 [Transcribed Audio]: "Text here"]
                        │
                        ▼
[LLM Agent processes prompt and responds]
```

---

## 3. Available Models & Tuning

To adjust the Whisper model for your hardware profile (trading speed vs. accuracy), edit `whisper/docker-compose.yml`:

* `tiny`: Ultra-fast (~200ms), 39M parameters, lower accuracy.
* `base` (Default): Optimal balance (~1s), 74M parameters, excellent for voice conversations.
* `small`: Higher accuracy (~2.5s), 244M parameters.
* `medium`: Advanced precision (~6s), 769M parameters.

After updating the model configuration, restart the service:
```bash
systemctl restart whisper-asr.service
```
