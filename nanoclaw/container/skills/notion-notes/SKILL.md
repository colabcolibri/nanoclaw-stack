---
name: notion-notes
description: Toma notas inteligentes, organiza atas de reunião, cria tarefas e gerencia bancos de dados e páginas no Notion.
---

# 📝 Skill: Notion Note Taking & Knowledge Management

Esta skill capacita o assistente a criar, organizar, categorizar e gerenciar notas, atas de reuniões, ideias, tarefas e bases de conhecimento no Notion do usuário através da ferramenta nativa `notion`.

---

## 🎯 Quando Usar

Ative esta skill sempre que o usuário:
1. Pedir para "anotar", "salvar", "registrar" ou "guardar uma ideia/insight".
2. Solicitar a criação de uma ata ou resumo de reunião estruturado.
3. Pedir para criar uma lista de tarefas, backlog ou tabela no Notion.
4. Quiser pesquisar ou consultar notas salvas anteriormente.
5. Pedir para adicionar informações complementares a uma nota ou página já existente.

---

## 🛠️ Como Usar a Ferramenta `notion`

### 1. Criar uma Nova Tabela / Banco de Dados
Se o usuário pedir para criar um espaço/tabela específica para notas, projetos ou finanças:
```json
{
  "action": "create_database",
  "title": "Anotações e Insights",
  "properties": {
    "Status": { "select": { "options": [{ "name": "Ideia" }, { "name": "Em Andamento" }, { "name": "Concluído" }] } },
    "Categoria": { "select": { "options": [{ "name": "Reunião" }, { "name": "Projeto" }, { "name": "Pessoal" }] } }
  }
}
```

### 2. Criar uma Nova Nota Estruturada
Para criar uma página com cabeçalhos, marcadores ou to-dos:
```json
{
  "action": "create_page",
  "title": "Alinhamento Estratégico - Colibri",
  "content": "# Resumo da Reunião\n- Definido escopo da nova stack\n- Alinhamento de prazos\n\n## Próximos Passos\n- [ ] Subir novos conectores\n- [ ] Validar com a equipe"
}
```

### 3. Consultar / Buscar no Notion
Para pesquisar se uma nota já existe ou buscar dados:
```json
{
  "action": "search",
  "query": "Colibri"
}
```

### 4. Adicionar Conteúdo a uma Página Existente
```json
{
  "action": "append_content",
  "page_id": "<ID_DA_PAGINA>",
  "content": "Adicionando novo ponto discutido na reunião das 15h."
}
```

---

## 💡 Boas Práticas ao Tomar Notas

1. **Estrutura Clara:** Use títulos concisos (`# Resumo`, `## Tópicos Principais`, `## Ações e Prazos`).
2. **Formatação Agradável:** Transforme itens de ação em caixas de seleção (`- [ ] Tarefa a fazer`).
3. **Feedback Imediato:** Sempre confirme ao usuário o título da nota criada e o link direto do Notion gerado pela API.
