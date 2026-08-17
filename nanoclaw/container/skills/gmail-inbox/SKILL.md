---
name: gmail-inbox
description: Gerenciamento inteligente de e-mails, triagem de caixa de entrada, busca avançada e leitura completa via Gmail API.
---

# Gmail Inbox & Executive Assistant Skill

Esta habilidade ensina o assistente a gerenciar com maestria a caixa de entrada do usuário utilizando a ferramenta nativa `google_gmail`.

## 🛠️ Capacidades Disponíveis na Ferramenta `google_gmail`:

1. **Listar e Buscar E-mails (`action: "list_messages"`):**
   * Use o parâmetro `query` com filtros avançados do Gmail:
     * `is:unread` (não lidos)
     * `newer_than:2d` (últimos 2 dias)
     * `from:nome@empresa.com` (de um remetente específico)
     * `subject:proposta` (pelo assunto)
   * Use `max_results` (ex: 15 a 50) para trazer a quantidade necessária sem ficar limitado a poucos itens.

2. **Ler Conteúdo Completo (`action: "read_message"`):**
   * Passe o `message_id` obtido na listagem para extrair o corpo integral do e-mail, data, remetente e destinatários.

3. **Criar Rascunho (`action: "create_draft"`):**
   * Passe `to`, `subject` e `body` para deixar o e-mail pronto na caixa de rascunhos para aprovação do usuário.

4. **Enviar E-mail (`action: "send_message"`):**
   * Envia o e-mail diretamente quando o usuário der a ordem explícita de envio.

## 🎯 Regras de Triagem e Apresentação:
* Sempre apresente os e-mails com data, remetente limpo e assunto em destaque.
* Ao resumir e-mails longos, destaque o objetivo principal e qualquer ação pendente.
