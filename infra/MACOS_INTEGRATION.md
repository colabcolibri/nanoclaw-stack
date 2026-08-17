# 💻 macOS & Apple Shortcuts Integration Guide

> Complete reference and tutorial for connecting your **MacBook** to your self-hosted **NanoClaw Assistant Stack** via native **Apple Shortcuts**, global keyboard hotkeys, menu bar widgets, and Siri voice commands.

---

## 🏛️ 1. Architecture & Channel Isolation

Unlike single-channel bots, the NanoClaw stack treats **macOS** as a first-class, independent messaging channel:

```text
┌─────────────────────────────────────────────────────────────┐
│                    Omnichannel Client                       │
│    📱 Telegram (Mobile)             💻 macOS (MacBook)      │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│   Telegram SQLite Session    │ │    macOS SQLite Session    │
│ (sess-1786913454461-rv0amh)  │ │    (sess-macos-sergio)     │
│  - inbound.db / outbound.db  │ │  - inbound.db / outbound.db│
└──────────────┬───────────────┘ └─────────────┬──────────────┘
               │                               │
               └───────────────┬───────────────┘
                               ▼
               ┌───────────────────────────────┐
               │       TurnOrchestrator        │
               │ (DeepSeek + Tools + Closure)  │
               └───────────────────────────────┘
```

### Key Isolation Principles:
* **Zero Context Contamination:** Conversation history on the MacBook is stored in `sess-macos-sergio/` and is strictly isolated from Telegram's `sess-1786913454461-rv0amh/`.
* **100% SQLite Persistence:** All incoming prompts and assistant replies are saved as native SQLite rows in `messages_in` and `messages_out`.
* **Bearer Token Security:** Protected by a dedicated API key (`mac_...`) stored locally on your server and validated on every request.

---

## 🔑 2. Connection Credentials

* **Endpoint URL:** `https://uai.sergioluciano.com/api/mac/prompt`
* **HTTP Method:** `POST`
* **Authentication:** `Authorization: Bearer <YOUR_MAC_API_KEY>`
* **Content-Type:** `application/json`
* **Request Body:** `{"prompt": "Sua mensagem aqui"}`
* **Response Payload:** `{"success": true, "reply": "Texto da resposta", "timestamp": "..."}`

*(You can copy your unique API key anytime from the Integrations tab at [uai.sergioluciano.com](https://uai.sergioluciano.com)).*

---

## 🛠️ 3. Step-by-Step Apple Shortcut Setup Guide (Visual Method)

Follow these exact steps in the native macOS **Atalhos (Shortcuts)** app:

### Step 1: Create a New Shortcut
1. Open the **Atalhos (Shortcuts)** app on your Mac.
2. Click the **`+` (New Shortcut)** button in the toolbar.
3. Rename the shortcut to **"Barão"** (or your assistant's name).

### Step 2: Add Actions in Sequence

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Pedir Entrada (Ask for Input)                            │
│    - Prompt: "O que deseja pedir ao Barão?"                │
│    - Tipo: Texto                                            │
├─────────────────────────────────────────────────────────────┤
│ 2. URL                                                      │
│    - Link: https://uai.sergioluciano.com/api/mac/prompt     │
├─────────────────────────────────────────────────────────────┤
│ 3. Obter Conteúdo do URL (Get Contents of URL)              │
│    - Método: POST                                           │
│    - Cabeçalhos (Headers):                                  │
│        • Authorization: Bearer [Sua Chave do Mac]           │
│        • Content-Type: application/json                     │
│    - Corpo da Solicitação: JSON                             │
│        • Campo (Texto): prompt = [Entrada Fornecida]        │
├─────────────────────────────────────────────────────────────┤
│ 4. Obter Valor do Dicionário (Get Dictionary Value)         │
│    - Obter: Valor                                           │
│    - Chave: reply                                           │
│    - em: Conteúdo do URL                                    │
├─────────────────────────────────────────────────────────────┤
│ 5. Exibir Notificação (Show Notification)                   │
│    - Texto: [Valor do Dicionário]                           │
│    - Título: "Barão 🤖"                                     │
├─────────────────────────────────────────────────────────────┤
│ 6. (Opcional) Falar Texto (Speak Text)                      │
│    - Texto: [Valor do Dicionário]                           │
│    - Idioma: Português (Brasil)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## ⌨️ 4. Global Keyboard Shortcuts & Menu Bar Access

To trigger the assistant from anywhere on your Mac in less than 1 second:

1. In the Shortcuts app, open the **Shortcut Details** inspector (icon with sliders on the right sidebar).
2. Check **"Usar como Atalho Rápido"** (*Use as Quick Action*).
3. Click **"Adicionar Atalho de Teclado"** (*Add Keyboard Shortcut*) and press your desired hotkey (recommended: `Cmd + Shift + B` or `Option + Space`).
4. Check **"Fixar na Barra de Menus"** (*Pin in Menu Bar*) to get a 1-click icon on the top macOS menu bar.
5. Check **"Fornecer para a Siri"** (*Provide to Siri*) to trigger via voice: *"E aí Siri, Barão"*.

---

## 🧪 5. Testing via macOS Terminal

You can test your connection instantly from `Terminal.app`:

```bash
curl -s -X POST https://uai.sergioluciano.com/api/mac/prompt \
  -H "Authorization: Bearer <YOUR_MAC_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Olá Barão! Teste de conexão do Terminal do Mac."}'
```
