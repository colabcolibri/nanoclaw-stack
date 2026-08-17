# 🧠 CONECTOR NATIVO DEEPSEEK

Este documento descreve a integração nativa direta com a API da DeepSeek.

---

## 1. Visão Geral do Conector

Diferente de wrappers pesados (como OpenCode ou OneCLI), o provedor **`deepseek`** do NanoClaw foi desenvolvido para conversar diretamente via HTTPS com a API da DeepSeek:

* **Código Host:** [`src/providers/deepseek.ts`](file:///opt/nanoclaw/src/providers/deepseek.ts) (Lê as variáveis de ambiente e injeta no container).
* **Código Container:** [`container/agent-runner/src/providers/deepseek.ts`](file:///opt/nanoclaw/container/agent-runner/src/providers/deepseek.ts) (Executa o streaming SSE via `fetch` nativo).

---

## 2. Parâmetros e Configurações

| Variável de Ambiente | Valor Atual | Descrição |
| :--- | :--- | :--- |
| `DEEPSEEK_API_KEY` | `sk-44018ef...` | Chave de autenticação oficial da DeepSeek. |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | Modelo de última geração (1M tokens de contexto). |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | Endpoint oficial da API. |
| `DEEPSEEK_HISTORY_LIMIT` | `20` | Quantidade de mensagens recentes mantidas no histórico imediato. |
| `NANOCLAW_AGENT_PROVIDER` | `deepseek` | Define o DeepSeek como provedor padrão do assistente. |

---

## 3. Como Funciona a Gestão de Contexto

1. **Janela Deslizante (Rolling Window):**
   * O conector mantém as últimas `DEEPSEEK_HISTORY_LIMIT` mensagens no histórico da sessão (armazenado em formato JSON na chave `continuation`).
   * Quando uma nova mensagem chega, ela é adicionada à fila e as mais antigas são descartadas do contexto imediato da API, mantendo o custo e a latência baixos.

2. **Injeção da Soul / Personalidade:**
   * Antes de cada prompt, o conector lê o arquivo [`groups/barao/instructions.prepend.md`](file:///opt/nanoclaw/groups/barao/instructions.prepend.md) e o injeta como mensagem de `system`.
   * Dessa forma, o modelo **nunca esquece quem ele é**, mesmo após centenas de mensagens trocadas.
