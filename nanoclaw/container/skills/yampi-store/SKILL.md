---
name: yampi-store
description: E-commerce operations, product inquiries, inventory availability, and order tracking on the Yampi online store platform.
domain: ecommerce_logistics
tools:
  - yampi_store
keywords:
  - yampi
  - store
  - order
  - tracking
  - inventory
  - stock
  - catalog
---

# Yampi E-Commerce Operations Skill

This skill allows the agent to inspect products, verify inventory levels, and check order statuses with privacy safeguards.

## 🛠️ Operations:

1. **Check Order:** `yampi_store(action: "get_order", client_email: "...", order_number: "...")`
2. **Search Products:** `yampi_store(action: "search_products", query: "...")`
3. **Verify Stock:** `yampi_store(action: "check_product_quantity", product_id: "...")`
4. **Links:** Always provide official tracking links (`tracking_url`) to clients.
