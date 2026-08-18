---
name: web-research
description: Real-time web search for current information, breaking news, market trends, and clean webpage extraction with zero API cost.
domain: web_research
tools:
  - web_search
  - browse_url
keywords:
  - web
  - internet
  - search
  - news
  - google
  - research
  - articles
  - websites
---

# Web Research & Live Intelligence Skill

This skill equips the assistant with real-time web search and clean webpage extraction capabilities.

## 🛠️ Available Tools:

1. **`web_search(query: "...", max_results: 10)`**:
   - Performs a real-time web search.
   - Returns page titles, authoritative URLs, and dense snippets.
   - **Efficiency Guide**: Request `max_results: 5` to `10` to gather broad multi-source evidence in a single query rather than running repeated search rounds.
   - Avoid executing slight query variations if initial results already contain the necessary facts.

2. **`browse_url(url: "https://...")`**:
   - Fetches and parses readable text directly from target webpage URLs.
   - Automatically strips ads, scripts, navbars, and boilerplate markup.
   - Use to dive deep into specific articles or official documentation discovered during search.
