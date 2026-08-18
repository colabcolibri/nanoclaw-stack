# 💻 Barão — App Nativo para macOS

> Aplicativo nativo em **Swift & SwiftUI** para interação instantânea via texto e voz com o ecossistema **NanoClaw / Barão AI**.

---

## ✨ Recursos

* **⚡ Ultraleve & Instantâneo:** Desenvolvido 100% em Swift/SwiftUI nativo (sem Electron, consumo mínimo de memória RAM).
* **💬 Chat Thread Completo:** Visualização contínua com histórico salvo no Mac e sincronizado com o servidor.
* **🎙️ Voz Nativa (Push to Talk):** Gravação de áudio com visualizador de ondas e transcrição no Whisper local.
* **🔊 Text-to-Speech (TTS):** Opção de ouvir as respostas do Barão em voz alta.
* **👑 Menu Bar & Atalhos:** Ícone fixado na barra de menus superior do macOS para acesso em 1 clique.
* **🔒 Segurança por Chave Bearer:** Armazenamento seguro de credenciais com validação estrita.

---

## 🛠️ Como Compilar e Instalar no seu Mac

No terminal do seu Mac:

```bash
# 1. Acesse a pasta do projeto
cd clients/macos

# 2. Execute o script de compilação
./build.sh
```

O script irá gerar o aplicativo pronto em:
* `dist/Barao.app`
* `dist/Barao-macOS.zip`

### Instalação:
1. Abra a pasta `dist/` no Finder (`open dist/`).
2. Arraste o **`Barao.app`** para a pasta **`Aplicativos` (`/Applications`)**.
3. Ao abrir pela primeira vez, clique em **Configurações (ícone de engrenagem)**:
   * **URL do Servidor:** `https://uai.sergioluciano.com`
   * **Chave de API:** Sua chave do Mac (`mac_...`)
4. Clique em **Testar Conexão** e pronto!

---

## 🏛️ Arquitetura do Código (SOLID / SRP / DRY)

* **`Models/`**: Entidades imutáveis e decodificáveis (`ChatMessage`, `AppConfig`, `ApiResponse`).
* **`Services/`**: Módulos desacoplados orientados a protocolos (`ApiClientService`, `AudioRecordingService`, `AudioPlaybackService`, `KeychainStorageService`).
* **`ViewModels/`**: Gerenciamento reativo de estado com `Combine` e `@MainActor` (`ChatViewModel`, `SettingsViewModel`).
* **`Views/`**: Componentes reutilizáveis e modulares em SwiftUI puro (`ChatView`, `ChatMessageBubbleView`, `ChatInputBarView`, `SettingsSheetView`).
