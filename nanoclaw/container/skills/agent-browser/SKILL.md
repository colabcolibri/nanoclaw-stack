---
name: web-research
description: Pesquisa avançada na web, busca em tempo real de notícias, tendências de mercado, leitura de links e artigos na internet com custo zero de API.
domain: web_research
tools:
  - web_search
  - browse_url
keywords:
  - web
  - internet
  - google
  - pesquisa
  - noticias
  - tendencias
  - artigos
  - sites
---

# Web Research & Live Intelligence Skill

Esta habilidade capacita o assistente a buscar informações em tempo real na internet, pesquisar notícias, acompanhar lançamentos e ler páginas web.

## 🛠️ Ferramentas Disponíveis:

1. **`web_search(query: "...", max_results: 5)`**:
   - Executa buscas em tempo real na internet.
   - Retorna os títulos das páginas, URLs oficiais e resumos (*snippets*).
   - Use para: notícias recentes, novidades de IA, cotações, artigos, documentações.

2. **`browse_url(url: "https://...")`**:
   - Lê e extrai o conteúdo em texto limpo de qualquer página da web.
   - Remove anúncios, scripts e poluição visual automaticamente.
   - Use para: ler artigos completos, posts de blog ou documentações técnicas encontradas na busca.
