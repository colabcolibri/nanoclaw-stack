---
name: agent-browser
description: Live web search and URL extraction via web_search and browse_url.
domain: web_research
tools:
  - web_search
  - browse_url
keywords:
  - web
  - internet
  - search
  - news
  - research
  - url
---

# Web research

## Decision map

| Intent | Call |
| :--- | :--- |
| Broad lookup | `web_search(query, max_results: 5-10)` |
| Deep read one page | `browse_url(url)` after search |

## Rules

1. One `web_search` with enough `max_results` before retrying similar queries.
2. `browse_url` on primary sources only — not every snippet.
3. Cite source URLs in summary. Never invent facts.
4. DONE + bullets with links. No conversational preamble.
