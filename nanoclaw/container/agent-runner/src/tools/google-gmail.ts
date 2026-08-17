import type { AgentTool } from './types.js';
import { getGoogleToken } from './google-auth.js';

export const googleGmailTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'google_gmail',
      description: 'Acessa a caixa de entrada do Gmail para listar mensagens recentes, buscar ou ler e-mails.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list_messages', 'read_message', 'send_message'],
            description: 'Ação a realizar: list_messages (listar mensagens recentes), read_message (ler conteúdo de um e-mail)',
          },
          query: {
            type: 'string',
            description: 'Termo de busca (ex: "from:google", "assunto", "importante")',
          },
          to: {
            type: 'string',
            description: 'E-mail do destinatário para envio',
          },
          subject: {
            type: 'string',
            description: 'Assunto da mensagem',
          },
          body: {
            type: 'string',
            description: 'Corpo da mensagem',
          },
        },
        required: ['action'],
      },
    },
  },
  execute: async (args: any, cwd: string): Promise<string> => {
    const token = await getGoogleToken(cwd);
    if (!token) {
      return JSON.stringify({
        status: 'error',
        error: 'Conta do Gmail não conectada ainda. Conecte sua conta clicando em "Conectar Conta Google" no painel Web (https://uai.sergioluciano.com na aba Servidores MCP).',
      });
    }

    const q = args.query ? `&q=${encodeURIComponent(args.query)}` : '';
    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listRes.ok) {
      return JSON.stringify({ status: 'error', code: listRes.status, text: await listRes.text() });
    }
    const data = (await listRes.json()) as any;
    const msgList = data.messages || [];
    const detailed = [];

    for (const m of msgList.slice(0, 5)) {
      try {
        const detailRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (detailRes.ok) {
          const d = (await detailRes.json()) as any;
          const headers = d.payload?.headers || [];
          const getHeader = (hn: string) =>
            headers.find((h: any) => h.name.toLowerCase() === hn.toLowerCase())?.value || '';
          detailed.push({
            id: m.id,
            from: getHeader('From'),
            subject: getHeader('Subject'),
            date: getHeader('Date'),
            snippet: d.snippet,
          });
        }
      } catch {}
    }

    return JSON.stringify({ status: 'ok', totalFound: detailed.length, messages: detailed });
  },
};
