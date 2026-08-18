---
name: yampi-store
description: Atendimento inteligente de e-commerce, consulta de produtos, disponibilidade de estoque e rastreamento de pedidos da loja virtual Yampi com trava de privacidade.
domain: ecommerce_logistics
tools:
  - yampi_store
keywords:
  - yampi
  - loja
  - pedido
  - pedidos
  - rastreio
  - rastreamento
  - estoque
  - catalogo
---

# Habilidade de Operações da Loja Virtual Yampi

Esta habilidade orienta o assistente a consultar pedidos, status de entrega e estoque de produtos da loja virtual Yampi com segurança e trava de privacidade.

## 🛠️ Operações:

1. **Rastreamento de Pedido:** `yampi_store(action: "get_order", client_email: "...", order_number: "...")`
2. **Busca de Produtos:** `yampi_store(action: "search_products", query: "...")`
3. **Checagem de Estoque:** `yampi_store(action: "check_product_quantity", product_id: "...")`
4. **Links Oficiais:** Sempre forneça o link oficial de rastreamento (`tracking_url`) para o cliente.
