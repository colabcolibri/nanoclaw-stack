# 💻 Barão — App Nativo para macOS

> Aplicativo de desktop independente, nativo em **Swift & SwiftUI**, para interação via texto e voz em tempo real com o assistente **Barão AI / NanoClaw**.

---

## ✨ Recursos

* **⚡ 100% Nativo & Ultraleve:** Desenvolvido em Swift & SwiftUI puro (sem Electron, ~3 MB de tamanho).
* **🎙️ Reconhecimento de Fala Nativo em Tempo Real:** Transcrição ao vivo de voz enquanto você fala utilizando o framework oficial da Apple (`SFSpeechRecognizer` com pontuação automática).
* **💬 Chat Thread Completo:** Histórico de conversa contínuo e persistente, sincronizado com o servidor.
* **⌨️ Atalho Global Rápido:** Pressione **`Control + \`** (`Ctrl + \`) em qualquer lugar do Mac para abrir/ocultar a janela instantaneamente.
* **🔊 Text-to-Speech (TTS):** Opção de ouvir as respostas lidas em voz alta pelo sintetizador da Apple.
* **👑 Barra de Menus (Menu Bar) & Dock:** Acesso rápido no topo da tela do macOS.
* **🔒 Armazenamento Seguro:** Credenciais salvas com segurança no Keychain do macOS.

---

## 🛠️ Como Compilar e Usar

No terminal do seu Mac:

```bash
# 1. Clone ou baixe este repositório no seu Mac
git clone git@github.com:colabcolibri/barao-macos.git
cd barao-macos

# 2. Compile o aplicativo (leva menos de 10 segundos)
./build.sh
```

O script criará o **`dist/Barao.app`** e o **`dist/Barao-macOS.zip`**.

### Instalação:
1. Arraste o **`Barao.app`** para a sua pasta **`Aplicativos` (`/Applications`)**.
2. Abra o aplicativo.
3. Se necessário, clique no ícone de **Configurações ⚙️**:
   - **URL do Servidor:** `https://uai.sergioluciano.com`
   - **Chave de API:** Sua chave do Mac (`mac_...`)
4. Clique em **Testar Conexão** e pronto!

---

## ⌨️ Atalhos Úteis

* **`Control + \`**: Abre ou oculta a janela do Barão em qualquer aplicativo.
* **`Return` (Enter)**: Envia a mensagem.
* **`Shift + Return`**: Pula uma linha no campo de texto.
* **`Cmd + W`**: Fecha/oculta a janela.
* **`Cmd + Q`**: Encerra o aplicativo.
* **`ESC`**: Fecha a tela de configurações.
