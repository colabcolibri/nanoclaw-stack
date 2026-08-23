---
name: notion-notes
description: Notion search, pages, tasks and database updates via notion tool.
domain: notion_management
tools:
  - notion
---

# Notion notes

## Decision map

| Intent | Call |
| :--- | :--- |
| Find pages/DBs | `notion(action: "search", query: "...")` |
| Create page/task | `notion(action: "create_page", parent_id, title, content?)` |
| Update | `notion(action: "update_page", page_id, properties?)` |

## Rules

1. CALL before claiming create/update/search results.
2. Return page title + Notion URL for every item touched.
3. DONE + JSON or markdown table. No filler text.
