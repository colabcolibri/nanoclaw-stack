---
name: yampi-store
description: Yampi orders, products, stock and tracking via yampi_store API.
domain: ecommerce_logistics
tools:
  - yampi_store
---

# Yampi store

## Decision map

| Intent | Call |
| :--- | :--- |
| Order lookup | `yampi_store(action: "get_order", client_email?, order_number?)` |
| Product search | `yampi_store(action: "search_products", query: "...")` |
| Stock check | `yampi_store(action: "check_product_quantity", product_id: "...")` |

## Rules

1. CALL API before quoting order status, prices, or stock.
2. Always include official `tracking_url` when present.
3. Respect privacy gates in API response — do not leak blocked fields.
4. DONE + raw structured fields. No assumptions.
