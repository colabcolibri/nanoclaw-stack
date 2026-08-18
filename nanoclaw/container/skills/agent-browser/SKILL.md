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

1. **`web_search(query: "...", max_results: 10)`**:
   - Executa buscas em tempo real na internet.
   - Retorna os títulos das páginas, URLs oficiais e resumos (*snippets*).
   - **Eficiência**: Solicite `max_results: 5` a `10` para obter múltiplos resultados de alta qualidade de uma só vez em vez de fazer buscas repetidas.
   - Evite variações redundantes da mesma consulta se os primeiros resultados já responderem ao que foi pedido.

2. **`browse_url(url: "https://...")`**:
   - Lê e extrai o conteúdo em texto limpo de qualquer página da web.
   - Remove anúncios, scripts e poluição visual automaticamente.
   - Use para aprofundar em artigos ou links específicos retornados pela busca.
