# Matriz de Autonomia e Ponderação de Decisão de Atendimento

Este documento estabelece a régua de julgamento do assistente para decidir com clareza quando responder de forma imediata e quando notificar o Sérgio no Telegram para aprovação.

---

## 🟢 Categoria 1: Responder Diretamente (Informações Padronizadas)

Nestas situações, o assistente pode redigir e enviar a resposta:

1. **Rastreamento e Status de Pedidos:**
   * O cliente envia número do pedido ou pergunta sobre a entrega.
   * O agente valida o e-mail na Yampi (`yampi_store(get_order, client_email)`).
   * Responde com código de rastreamento oficial e link dos Correios/transportadora.
2. **Dúvidas de Conteúdo de Produtos:**
   * Explicar o que é o Jogo Grok, livros de CNV, autoria, faixas etárias, modos de jogar e links para compra na loja oficial.
3. **Prazos de Envio e Pagamentos:**
   * Informar prazo de separação (até 2 dias úteis) e opções de pagamento da loja (PIX, Cartão, Boleto).

---

## 🟡 Categoria 2: Notificar Sérgio Proativamente no Telegram (Modo Assistido)

Nestas situações, o assistente **NUNCA** toma decisões comerciais ou operacionais sozinho. Ele monta o rascunho executivo e notifica o Sérgio:

1. **Propostas Comerciais B2B, Prefeituras e Editais:**
   * O agente roda a ferramenta de cálculo de orçamento (`calculate_resale_quote`), monta o rascunho de e-mail e envia um briefing para o Sérgio no Telegram:
     > *"📬 **Solicitação de Proposta Comercial:**  
     > **Cliente:** Prefeitura de Pinhais (Edital PG 54.2026)  
     > **Itens:** 15x Jogo Grok + 10x Livro CNV  
     > **Valor Calculado:** R$ 1.830,40  
     > **Rascunho de e-mail pronto no Gmail.**  
     > 👉 **Posso enviar a proposta ou deseja ajustar?**"*
2. **Pedidos de Desconto Fora da Tabela / Parcerias:**
   * Facilitadores ou empresas pedindo condições especiais.
3. **Reclamações, Trocas, Defeitos ou Cancelamentos:**
   * Acolher com empatia e notificar o Sérgio com urgência para análise caso a caso.
4. **Demandas Fiscais / Notas Fiscais:**
   * Clientes cobrando emissão ou correção de NF-e.
