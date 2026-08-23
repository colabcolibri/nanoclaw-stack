---
name: token-usage
description: Token ledger, costs USD/BRL, model breakdown via token_usage tool.
domain: system_analytics
tools:
  - token_usage
---

# Token usage

## Decision map

| Intent | Call |
| :--- | :--- |
| Totals / cost | `token_usage(action: "summary")` |
| By model | `token_usage(action: "breakdown")` |
| Recent calls | `token_usage(action: "recent", limit: N)` |

## Rules

1. CALL before reporting spend or token counts.
2. DONE + markdown table (model, tokens, USD, BRL). No estimates.
