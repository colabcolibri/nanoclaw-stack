---
name: gmail-inbox
description: Gerenciamento inteligente de e-mails, triagem de caixa de entrada, busca avançada combinada e leitura completa via Gmail API.
---

# Gmail Inbox & Executive Search Skill

Esta habilidade capacita o assistente a executar pesquisas avançadas e combinadas na caixa de entrada do Gmail através da ferramenta `google_gmail`.

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

## 🛠️ Fluxo de Trabalho Recomendado:

1. **Busca/Listagem:** Use `list_messages` com a `query` combinada e `max_results` adequado.
2. **Leitura de Contexto:** Se o usuário pedir detalhes ou se o e-mail for crítico, use `read_message(message_id)` para ler o corpo integral.
3. **Resumo Executivo:** Apresente os resultados de forma clara, com data, remetente, assunto e o ponto-chave de cada mensagem.
4. **Ação Rápida:** Ofereça para redigir uma resposta ou criar um rascunho (`create_draft`) quando apropriado.
