---
name: notion-notes
description: Smart note taking, meeting minutes organization, task creation, and database/page management in Notion.
domain: notion_management
tools:
  - notion
keywords:
  - notion
  - notes
  - tasks
  - database
  - page
  - reminders
---

# Notion Notes & Task Management Skill

This skill guides the assistant to manage workspaces, notes, and task databases in Notion.

## 🛠️ Operations:
1. **Search Pages & Databases:** `notion(action: "search", query: "...")`
2. **Create Task / Note:** `notion(action: "create_page", parent_id: "...", title: "...", content: "...")`
3. **Update Tasks:** `notion(action: "update_page", page_id: "...", properties: { ... })`
4. **References:** Always return page titles and Notion URLs for created or modified items.
