# Estudo de Integração: Cotação de Frete (Correios & Transportadoras)

Este documento registra a estratégia técnica para futura implementação do cálculo automático de frete nas propostas comerciais e orçamentos de revenda da Loja Colibri.

---

## 1. Abordagens Técnicas

### 🌟 Opção A: Gateway de Frete da Yampi (Recomendada)
* **Endpoint:** `POST https://api.dooki.com.br/v2/{alias}/shipping/calculate`
* **Vantagens:**
  * Já aproveita contratos com desconto da loja (Melhor Envio / Correios / Jadlog / Loggi).
  * Retorna múltiplas cotações simultâneas com prazos de entrega e valores negociados.
  * Utiliza as mesmas credenciais da Yampi já salvas no NanoClaw.

### 📦 Opção B: API Oficial dos Correios (CWS / REST)
* **Endpoint:** `https://api.correios.com.br/preco/v1/nacional`
* **Parâmetros:**
  * CEP de Origem (Expedição / Fulfillment Colibri).
  * CEP de Destino (Cliente).
  * Peso e Cubagem calculados pela soma dos produtos do pedido.

---

## 2. Estrutura de Implementação

1. **Campos de Peso no CSV (`tabela_precos_revenda.csv`):**
   * Adicionar coluna `weight_grams` e `box_volume_cm3` para cada produto (ex: Jogo Grok ≈ 380g, Livros ≈ 220g).
2. **Motor de Cálculo (`scripts/calcular_orcamento.ts`):**
   * Recebe o `cep` de destino do comprador.
   * Calcula o peso total e consulta o endpoint de cotação.
   * Insere o bloco de opções de frete (PAC, SEDEX, Transportadora) com prazos no orçamento.
