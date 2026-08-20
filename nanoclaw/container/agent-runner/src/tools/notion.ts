import fs from 'fs';
import path from 'path';
import type { AgentTool } from './types.js';

async function getNotionToken(cwd: string): Promise<{ apiKey: string; defaultDatabaseId?: string } | null> {
  const candidatePaths = [
    path.join(cwd, 'notion_tokens.json'),
    '/workspace/group/notion_tokens.json',
    '/workspace/agent/notion_tokens.json',
    ...(process.env.AGENT_GROUP_DIR ? [path.join(process.env.AGENT_GROUP_DIR, 'notion_tokens.json')] : []),
  ];
  let tokenFile = '';
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      tokenFile = p;
      break;
    }
  }

  if (tokenFile) {
    try {
      const data = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));
      if (data.apiKey || data.access_token || data.token) {
        return {
          apiKey: data.apiKey || data.access_token || data.token,
          defaultDatabaseId: data.defaultDatabaseId || data.databaseId,
        };
      }
    } catch {}
  }

  if (process.env.NOTION_API_KEY) {
    return {
      apiKey: process.env.NOTION_API_KEY,
      defaultDatabaseId: process.env.NOTION_DATABASE_ID,
    };
  }

  return null;
}

export const notionTool: AgentTool = {
  domain: 'notion_management',
  definition: {
    type: 'function',
    function: {
      name: 'notion',
      description: 'Manages pages, notes, documents, and databases (tables) in Notion.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create_page', 'create_database', 'update_database', 'update_page', 'search', 'query_database', 'append_content', 'get_page'],
            description: 'Action to perform: "create_page" (create new page/note or database row), "update_page" (update fields of existing page/row), "create_database" (create new table), "update_database" (alter columns/properties), "search" (search workspace), "query_database" (query table rows), "append_content" (append markdown blocks to a page), "get_page" (retrieve page content and properties).',
          },
          title: {
            type: 'string',
            description: 'Title of the page, note, or database.',
          },
          parent_id: {
            type: 'string',
            description: 'ID of parent page or database container.',
          },
          database_id: {
            type: 'string',
            description: 'ID of the database to query or insert records into.',
          },
          page_id: {
            type: 'string',
            description: 'ID of existing page to read, update, or append to.',
          },
          query: {
            type: 'string',
            description: 'Search query string.',
          },
          content: {
            type: 'string',
            description: 'Markdown text content or paragraphs to add to the page.',
          },
          properties: {
            type: 'object',
            description: 'Structured properties/fields for database rows or column definitions.',
          },
        },
        required: ['action'],
      },
    },
  },
  execute: async (args: any, cwd: string): Promise<string> => {
    const auth = await getNotionToken(cwd);
    if (!auth || !auth.apiKey) {
      return JSON.stringify({
        status: 'error',
        error: 'Chave do Notion não configurada. Conecte sua integração com o Notion pelo painel Web (https://uai.sergioluciano.com na aba Servidores/Integrações) ou crie o arquivo notion_tokens.json.',
      });
    }

    const headers = {
      Authorization: `Bearer ${auth.apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    };

    try {
      // 1. Search pages or databases
      if (args.action === 'search') {
        const searchRes = await fetch('https://api.notion.com/v1/search', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: args.query || args.title || '',
            page_size: 10,
          }),
        });
        if (!searchRes.ok) {
          return JSON.stringify({ status: 'error', code: searchRes.status, text: await searchRes.text() });
        }
        const data = (await searchRes.json()) as any;
        const results = (data.results || []).map((item: any) => {
          let name = '(Sem título)';
          if (item.object === 'database') {
            name = item.title?.[0]?.plain_text || '(Database sem título)';
          } else if (item.object === 'page') {
            const titleProp = Object.values(item.properties || {}).find((p: any) => p.type === 'title') as any;
            name = titleProp?.title?.[0]?.plain_text || '(Página sem título)';
          }
          return {
            id: item.id,
            type: item.object,
            title: name,
            url: item.url,
            created_time: item.created_time,
            last_edited_time: item.last_edited_time,
          };
        });
        return JSON.stringify({ status: 'ok', total: results.length, results });
      }

      // 2. Create Database / Table
      if (args.action === 'create_database') {
        let parentPageId = args.parent_id;
        if (!parentPageId) {
          // Find first available page as parent
          const findRes = await fetch('https://api.notion.com/v1/search', {
            method: 'POST',
            headers,
            body: JSON.stringify({ filter: { value: 'page', property: 'object' }, page_size: 1 }),
          });
          const findData = (await findRes.json()) as any;
          if (findData.results?.[0]?.id) {
            parentPageId = findData.results[0].id;
          } else {
            return JSON.stringify({
              status: 'error',
              error: 'ID da página pai (parent_id) é obrigatório para criar um banco de dados no Notion.',
            });
          }
        }

        const schemaProperties: Record<string, any> = {
          Nome: { title: {} },
          Status: {
            select: {
              options: [
                { name: 'Não iniciado', color: 'gray' },
                { name: 'Em andamento', color: 'blue' },
                { name: 'Concluído', color: 'green' },
              ],
            },
          },
          Categoria: {
            select: {
              options: [
                { name: 'Ideia', color: 'purple' },
                { name: 'Reunião', color: 'orange' },
                { name: 'Tarefa', color: 'red' },
                { name: 'Nota', color: 'blue' },
              ],
            },
          },
          Data: { date: {} },
          Tags: { multi_select: {} },
          ...(args.properties || {}),
        };

        const dbRes = await fetch('https://api.notion.com/v1/databases', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            parent: { type: 'page_id', page_id: parentPageId },
            title: [{ type: 'text', text: { content: args.title || 'Notas e Tarefas do Barão' } }],
            properties: schemaProperties,
          }),
        });

        if (!dbRes.ok) {
          return JSON.stringify({ status: 'error', code: dbRes.status, text: await dbRes.text() });
        }
        const createdDb = (await dbRes.json()) as any;
        return JSON.stringify({
          status: 'ok',
          id: createdDb.id,
          title: args.title || 'Notas e Tarefas do Barão',
          url: createdDb.url,
          message: 'Banco de dados criado com sucesso no Notion.',
        });
      }

      // 3. Create Page / Note (in database or parent page)
      if (args.action === 'create_page') {
        const targetDbId = args.database_id || auth.defaultDatabaseId;
        const pageTitle = args.title || 'Nova Nota';
        const childrenBlocks: any[] = [];

        if (args.content) {
          const lines = String(args.content).split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            if (line.startsWith('# ')) {
              childrenBlocks.push({
                object: 'block',
                type: 'heading_1',
                heading_1: { rich_text: [{ type: 'text', text: { content: line.replace(/^#\s+/, '') } }] },
              });
            } else if (line.startsWith('## ')) {
              childrenBlocks.push({
                object: 'block',
                type: 'heading_2',
                heading_2: { rich_text: [{ type: 'text', text: { content: line.replace(/^##\s+/, '') } }] },
              });
            } else if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
              childrenBlocks.push({
                object: 'block',
                type: 'to_do',
                to_do: {
                  rich_text: [{ type: 'text', text: { content: line.replace(/^- \[[ x]\]\s+/, '') } }],
                  checked: line.startsWith('- [x] '),
                },
              });
            } else if (line.startsWith('- ') || line.startsWith('* ')) {
              childrenBlocks.push({
                object: 'block',
                type: 'bulleted_list_item',
                bulleted_list_item: { rich_text: [{ type: 'text', text: { content: line.replace(/^[-*]\s+/, '') } }] },
              });
            } else {
              childrenBlocks.push({
                object: 'block',
                type: 'paragraph',
                paragraph: { rich_text: [{ type: 'text', text: { content: line } }] },
              });
            }
          }
        }

        let payload: any = {};
        if (targetDbId) {
          // Fetch database schema to detect actual title property and existing columns
          let titlePropName = 'Name';
          let existingProps: Record<string, any> = {};

          try {
            const dbCheckRes = await fetch(`https://api.notion.com/v1/databases/${targetDbId}`, { headers });
            if (dbCheckRes.ok) {
              const dbData = (await dbCheckRes.json()) as any;
              existingProps = dbData.properties || {};
              const foundTitle = Object.entries<any>(existingProps).find(([_, v]) => v.type === 'title');
              if (foundTitle) titlePropName = foundTitle[0];

              // Check if args.properties has new columns that don't exist yet, and auto-add them
              const missingCols: Record<string, any> = {};
              if (args.properties) {
                for (const [key, val] of Object.entries<any>(args.properties)) {
                  if (!existingProps[key]) {
                    if (val?.select) missingCols[key] = { select: {} };
                    else if (val?.multi_select) missingCols[key] = { multi_select: {} };
                    else if (val?.date) missingCols[key] = { date: {} };
                    else missingCols[key] = { rich_text: {} };
                  }
                }
              }

              if (Object.keys(missingCols).length > 0) {
                await fetch(`https://api.notion.com/v1/databases/${targetDbId}`, {
                  method: 'PATCH',
                  headers,
                  body: JSON.stringify({ properties: missingCols }),
                });
              }
            }
          } catch {}

          const recordProps: Record<string, any> = {
            [titlePropName]: { title: [{ text: { content: pageTitle } }] },
          };

          // Append additional properties if supported
          if (args.properties) {
            for (const [key, val] of Object.entries<any>(args.properties)) {
              if (key === titlePropName) continue;
              recordProps[key] = val;
            }
          }

          payload = {
            parent: { database_id: targetDbId },
            properties: recordProps,
            children: childrenBlocks.slice(0, 50),
          };
        } else {
          let parentPageId = args.parent_id;
          if (!parentPageId) {
            const findRes = await fetch('https://api.notion.com/v1/search', {
              method: 'POST',
              headers,
              body: JSON.stringify({ filter: { value: 'page', property: 'object' }, page_size: 1 }),
            });
            const findData = (await findRes.json()) as any;
            parentPageId = findData.results?.[0]?.id;
          }

          if (!parentPageId) {
            return JSON.stringify({
              status: 'error',
              error: 'ID da página pai (parent_id) ou database_id é necessário para criar a nota.',
            });
          }

          payload = {
            parent: { page_id: parentPageId },
            properties: {
              title: [{ text: { content: pageTitle } }],
            },
            children: childrenBlocks.slice(0, 50),
          };
        }

        const createRes = await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        if (!createRes.ok) {
          return JSON.stringify({ status: 'error', code: createRes.status, text: await createRes.text() });
        }
        const createdPage = (await createRes.json()) as any;
        return JSON.stringify({
          status: 'ok',
          id: createdPage.id,
          title: pageTitle,
          url: createdPage.url,
          message: 'Página/Nota criada com sucesso no Notion.',
        });
      }

      // 4. Query Database
      if (args.action === 'query_database') {
        const dbId = args.database_id || auth.defaultDatabaseId;
        if (!dbId) {
          return JSON.stringify({ status: 'error', error: 'database_id é obrigatório para consultar tabela.' });
        }

        const queryRes = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ page_size: 15 }),
        });

        if (!queryRes.ok) {
          return JSON.stringify({ status: 'error', code: queryRes.status, text: await queryRes.text() });
        }
        const queryData = (await queryRes.json()) as any;
        const rows = (queryData.results || []).map((row: any) => {
          const props: Record<string, any> = {};
          for (const [key, val] of Object.entries<any>(row.properties || {})) {
            if (val.type === 'title') props[key] = val.title?.[0]?.plain_text || '';
            else if (val.type === 'rich_text') props[key] = val.rich_text?.[0]?.plain_text || '';
            else if (val.type === 'select') props[key] = val.select?.name || '';
            else if (val.type === 'multi_select') props[key] = (val.multi_select || []).map((m: any) => m.name);
            else if (val.type === 'date') props[key] = val.date?.start || '';
          }
          return { id: row.id, url: row.url, ...props };
        });

        return JSON.stringify({ status: 'ok', totalRows: rows.length, rows });
      }

      // 5. Append Content to existing page
      if (args.action === 'append_content') {
        if (!args.page_id) {
          return JSON.stringify({ status: 'error', error: 'page_id é obrigatório para adicionar conteúdo.' });
        }
        const textContent = args.content || args.query || '';
        const appendRes = await fetch(`https://api.notion.com/v1/blocks/${args.page_id}/children`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            children: [
              {
                object: 'block',
                type: 'paragraph',
                paragraph: { rich_text: [{ type: 'text', text: { content: textContent } }] },
              },
            ],
          }),
        });
        if (!appendRes.ok) {
          return JSON.stringify({ status: 'error', code: appendRes.status, text: await appendRes.text() });
        }
        return JSON.stringify({ status: 'ok', message: 'Conteúdo adicionado à página com sucesso.' });
      }

      // 6. Get Page details
      if (args.action === 'get_page') {
        if (!args.page_id) {
          return JSON.stringify({ status: 'error', error: 'page_id é obrigatório para ler uma página.' });
        }
        const pageRes = await fetch(`https://api.notion.com/v1/pages/${args.page_id}`, { headers });
        const blocksRes = await fetch(`https://api.notion.com/v1/blocks/${args.page_id}/children?page_size=30`, { headers });
        if (!pageRes.ok) {
          return JSON.stringify({ status: 'error', code: pageRes.status, text: await pageRes.text() });
        }
        const pageData = (await pageRes.json()) as any;
        const blocksData = blocksRes.ok ? ((await blocksRes.json()) as any) : { results: [] };
        
        const contentLines = (blocksData.results || []).map((b: any) => {
          const type = b.type;
          const text = b[type]?.rich_text?.[0]?.plain_text || '';
          return text;
        }).filter(Boolean);

        return JSON.stringify({
          status: 'ok',
          id: pageData.id,
          url: pageData.url,
          created_time: pageData.created_time,
          content: contentLines.join('\n'),
        });
      }

      // 7. Update Database Schema (add/modify/rename/remove columns)
      if (args.action === 'update_database') {
        const dbId = args.database_id || auth.defaultDatabaseId;
        if (!dbId) {
          return JSON.stringify({ status: 'error', error: 'database_id é obrigatório para atualizar estrutura da tabela.' });
        }

        const payload: any = {};
        if (args.title) {
          payload.title = [{ type: 'text', text: { content: args.title } }];
        }
        if (args.properties && Object.keys(args.properties).length > 0) {
          payload.properties = args.properties;
        }

        const updateRes = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(payload),
        });

        if (!updateRes.ok) {
          return JSON.stringify({ status: 'error', code: updateRes.status, text: await updateRes.text() });
        }
        const updatedDb = (await updateRes.json()) as any;
        return JSON.stringify({
          status: 'ok',
          id: updatedDb.id,
          url: updatedDb.url,
          message: 'Estrutura / Colunas do banco de dados no Notion atualizadas com sucesso.',
        });
      }

      // 8. Update Page Properties
      if (args.action === 'update_page') {
        if (!args.page_id) {
          return JSON.stringify({ status: 'error', error: 'page_id é obrigatório para atualizar campos da página/registro.' });
        }

        const updatePageRes = await fetch(`https://api.notion.com/v1/pages/${args.page_id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ properties: args.properties || {} }),
        });

        if (!updatePageRes.ok) {
          return JSON.stringify({ status: 'error', code: updatePageRes.status, text: await updatePageRes.text() });
        }
        const updatedPage = (await updatePageRes.json()) as any;
        return JSON.stringify({
          status: 'ok',
          id: updatedPage.id,
          url: updatedPage.url,
          message: 'Página / Registro atualizado com sucesso no Notion.',
        });
      }

      return `Ação desconhecida: ${args.action}`;
    } catch (err: any) {
      return JSON.stringify({ status: 'error', error: err.message || String(err) });
    }
  },
};
