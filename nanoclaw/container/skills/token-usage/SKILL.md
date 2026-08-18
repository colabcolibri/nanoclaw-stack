---
name: token-usage
description: Consulta extrato de consumo de tokens, custos acumulados em Reais (BRL) e Dólares (USD), e métricas de uso de IA por modelo.
domain: system_analytics
tools: [token_usage]
keywords: [tokens, token, consumo, gasto, quanto gastei, custo, extrato, faturamento, uso de ia, api cost, consumo de hoje]
---

# 📊 Token Usage & Cost Analytics Skill

Esta habilidade capacita o assistente a consultar o banco de dados do extrato de tokens (`token_usage.db`) e apresentar relatórios executivos claros de consumo e custos em Reais (BRL) para o operador.

---

## 🛠️ Como Usar a Ferramenta `token_usage`

### 1. Resumo do Dia Atual (Hoje)
Quando o usuário perguntar *"quanto gastamos hoje?"*, *"qual o consumo de tokens hoje?"*:
```json
{
  "action": "get_summary",
  "period": "today"
}
```

### 2. Resumo de Outros Períodos (Ontem, 7 Dias, Total)
* `period: "yesterday"` — Consumo de ontem.
* `period: "7d"` — Últimos 7 dias.
* `period: "30d"` — Últimos 30 dias.
* `period: "all"` — Histórico completo.

### 3. Detalhes das Últimas Chamadas
Para ver o detalhe de cada requisição recente:
```json
{
  "action": "get_recent_logs",
  "limit": 10
}
```

---

## 🎨 Padrão Visual de Resposta Executiva

Apresente os dados sempre com formatação executiva elegante:

```markdown
📊 **EXTRATO DE CONSUMO DE TOKENS (Hoje)**

* **Total de Requisições:** 14 chamadas
* **Tokens de Entrada (Prompt):** 42.150 tokens
* **Tokens de Saída (Completion):** 5.820 tokens
* **Total Geral:** 47.970 tokens
* **Custo Total Estimado:** 💵 **R$ 0,0842** *(~US$ 0.0162)*

---

### 🤖 **Consumo por Modelo:**
| Modelo | Chamadas | Tokens | Custo (BRL) |
| :--- | :--- | :--- | :--- |
| `openai/gpt-oss-20b` | 10 | 32.100 | R$ 0,0520 |
| `deepseek-v4-flash` | 4 | 15.870 | R$ 0,0322 |

💡 *Dica do Barão: Com a nova arquitetura de roteamento por domínios, economizamos mais de 80% dos tokens de entrada por interação.*
```
