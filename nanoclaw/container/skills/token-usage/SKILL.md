---
name: token-usage
description: Query token consumption metrics, accumulated expenses in BRL and USD, and LLM activity logs.
domain: system_analytics
tools:
  - token_usage
keywords:
  - token
  - tokens
  - usage
  - cost
  - costs
  - ledger
  - metrics
  - consumption
---

# Token Usage & LLM Cost Analytics Skill

This skill allows the assistant to inspect real-time token consumption ledgers, cost breakdowns, and active model rates.

## 🛠️ Operations:
1. **Financial Summary:** `token_usage(action: "summary")` -> Total tokens, costs in USD ($) and BRL (R$).
2. **Usage Breakdown:** `token_usage(action: "breakdown")` -> Consumption segmented by model.
3. **Recent Activity:** `token_usage(action: "recent", limit: 5)` -> Detailed ledger of latest LLM transactions.
