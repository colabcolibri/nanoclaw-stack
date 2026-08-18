---
name: gmail-inbox
description: Gerenciamento inteligente de e-mails, triagem de caixa de entrada, busca avançada combinada, leitura completa e respostas via Gmail API.
domain: google_suite
tools: [google_gmail]
keywords: [email, e-mail, emails, e-mails, gmail, inbox, caixa de entrada, mensagem, mensagens, darf, inss, gestta]
---

# Gmail Inbox & Executive Search Skill

Esta habilidade capacita o assistente a executar pesquisas avançadas e combinadas na caixa de entrada do Gmail, ler conversas completas em thread, criar ou excluir rascunhos e enviar respostas anexadas diretamente na mesma conversa.

## 🔍 Guia de Operadores de Busca Combinada (`query`):

O assistente deve traduzir os pedidos do usuário em operadores nativos do Gmail:

| Pedido do Usuário | Filtro `query` recomendado |
| :--- | :--- |
| **"E-mails não lidos sobre contratos"** | `is:unread subject:contrato` |
| **"E-mails não lidos de clientes específicos"** | `is:unread from:cliente@empresa.com` |
| **"E-mails dos últimos 2 dias com anexo"** | `newer_than:2d has:attachment` |
| **"E-mails não lidos que não sejam promoções"** | `is:unread -category:promotions` |
| **"E-mails com PDFs ou planilhas recebidos esta semana"** | `filename:pdf OR filename:xlsx newer_than:7d` |
| **"E-mails importantes do financeiro"** | `is:important from:financeiro` |
| **"E-mails recebidos em uma data específica"** | `after:2026/08/10 before:2026/08/17` |
| **"Assunto exato"** | `subject:"Proposta de Parceria 2026"` |

---

## 🛠️ Fluxo de Trabalho & Operações:

1. **Busca/Listagem:** Use `list_messages` com a `query` combinada e `max_results` adequado.
2. **Leitura de Contexto:** Se o usuário pedir detalhes ou se o e-mail for crítico, use `read_message(message_id)` para ler o corpo e o histórico completo da thread.
3. **Respostas em Thread:** Ao criar rascunho (`create_draft`) ou enviar (`send_message`), **SEMPRE passe `thread_id` e `message_id`** para garantir que a resposta permaneça na mesma thread existente.
4. **Gerenciamento de Rascunhos:**
   * Listar rascunhos: `google_gmail(action: "list_drafts")`
   * Excluir rascunho: `google_gmail(action: "delete_draft", draft_id: "...")`
5. **Formatação de Texto:** Redija o corpo do e-mail em texto corrido contínuo, sem quebras arbitrárias no meio das frases.
