import type { AgentTool } from './types.js';
import { getGoogleToken } from './google-auth.js';

function decodeBase64Url(data: string): string {
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

function extractBody(payload: any): string {
  if (!payload) return '';
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts && Array.isArray(payload.parts)) {
    // Prefer text/plain, fallback to text/html
    const plainPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
    if (plainPart?.body?.data) {
      return decodeBase64Url(plainPart.body.data);
    }
    const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
    if (htmlPart?.body?.data) {
      return decodeBase64Url(htmlPart.body.data).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }
  return '';
}

export const googleGmailTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'google_gmail',
      description:
        'Acessa a caixa de entrada do Gmail para listar conversas (threads), buscar e-mails com filtros avançados, ler o conteúdo completo de uma mensagem/thread, criar rascunhos ou enviar respostas.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list_messages', 'read_message', 'create_draft', 'send_message'],
            description:
              'Ação a realizar: list_messages (listar conversas da caixa de entrada ou busca), read_message (ler conteúdo completo por message_id ou thread_id), create_draft (criar rascunho), send_message (enviar e-mail).',
          },
          folder: {
            type: 'string',
            enum: ['inbox', 'sent', 'starred', 'all'],
            description: 'Pasta a consultar (padrão: "inbox" para Caixa de Entrada exclusiva).',
          },
          query: {
            type: 'string',
            description:
              'Operadores de busca avançada do Gmail combinados (ex: "is:unread", "newer_than:3d", "from:fulano@empresa.com", "subject:contrato"). Por padrão pesquisa dentro da Caixa de Entrada (in:inbox).',
          },
          max_results: {
            type: 'number',
            description: 'Quantidade máxima de conversas a retornar ao listar (padrão 50, máximo 100).',
          },
          message_id: {
            type: 'string',
            description: 'ID da mensagem ou thread para ler na íntegra (obrigatório para read_message).',
          },
          to: {
            type: 'string',
            description: 'E-mail do destinatário para envio ou rascunho.',
          },
          subject: {
            type: 'string',
            description: 'Assunto do e-mail.',
          },
          body: {
            type: 'string',
            description: 'Conteúdo/corpo do e-mail.',
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
        error:
          'Conta do Gmail não conectada ainda. Conecte sua conta clicando em "Conectar Conta Google" no painel Web (https://uai.sergioluciano.com na aba Servidores MCP).',
      });
    }

    const action = args.action || 'list_messages';

    // 1. READ MESSAGE OR THREAD
    if (action === 'read_message' || action === 'read_thread') {
      const msgId = args.message_id || args.id || args.thread_id;
      if (!msgId) {
        return JSON.stringify({ status: 'error', error: 'Parâmetro message_id ou thread_id é obrigatório.' });
      }

      // Try fetching as thread first to get full conversation history
      let isThread = true;
      let res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${msgId}?format=full`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        isThread = false;
        res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (!res.ok) {
        return JSON.stringify({ status: 'error', code: res.status, text: await res.text() });
      }

      const data = (await res.json()) as any;

      if (isThread && Array.isArray(data.messages) && data.messages.length > 0) {
        const rawMsgs = data.messages;
        const parsedMsgs = rawMsgs.map((m: any, idx: number) => {
          const headers = m.payload?.headers || [];
          const getH = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
          const fromVal = getH('From');
          const isFromMe = fromVal.includes('colabcolibri') || fromVal.includes('sergio') || fromVal.includes('equipe');
          const body = extractBody(m.payload) || m.snippet || '';

          return {
            index: idx + 1,
            messageId: m.id,
            from: fromVal,
            to: getH('To'),
            subject: getH('Subject'),
            date: getH('Date'),
            snippet: m.snippet,
            isFromMe,
            body: body.slice(0, 3000),
          };
        });

        const lastMsg = parsedMsgs[parsedMsgs.length - 1];
        const previousMsgs = parsedMsgs.slice(0, -1);

        return JSON.stringify({
          status: 'ok',
          threadId: data.id,
          totalMessagesInThread: parsedMsgs.length,
          subject: lastMsg.subject,
          lastSender: lastMsg.from,
          lastDate: lastMsg.date,
          needsReply: !lastMsg.isFromMe,
          lastMessage: {
            from: lastMsg.from,
            to: lastMsg.to,
            date: lastMsg.date,
            snippet: lastMsg.snippet,
            body: lastMsg.body,
          },
          previousMessages: previousMsgs.map((p: any) => ({
            from: p.from,
            date: p.date,
            snippet: p.snippet,
            isFromMe: p.isFromMe,
          })),
        });
      }

      // Single message fallback
      const headers = data.payload?.headers || [];
      const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
      const bodyText = extractBody(data.payload) || data.snippet || '';
      const fromVal = getHeader('From');
      const isFromMe = fromVal.includes('colabcolibri') || fromVal.includes('sergio');

      return JSON.stringify({
        status: 'ok',
        id: data.id,
        threadId: data.threadId || data.id,
        totalMessagesInThread: 1,
        from: fromVal,
        to: getHeader('To'),
        subject: getHeader('Subject'),
        date: getHeader('Date'),
        snippet: data.snippet,
        needsReply: !isFromMe,
        body: bodyText.slice(0, 4000),
      });
    }

    // 2. CREATE DRAFT OR SEND MESSAGE
    if (action === 'create_draft' || action === 'send_message') {
      if (!args.to || !args.subject || !args.body) {
        return JSON.stringify({
          status: 'error',
          error: 'Parâmetros "to", "subject" e "body" são obrigatórios para envio/rascunho.',
        });
      }

      const utf8Subject = `=?utf-8?B?${Buffer.from(args.subject).toString('base64')}?=`;
      const fromAlias = args.from_alias || 'Assistente Virtual da Colibri <contato@colabcolibri.com>';
      const emailLines = [
        `From: ${fromAlias}`,
        `To: ${args.to}`,
        `Subject: ${utf8Subject}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: 8bit',
        '',
        args.body,
      ];
      const rawEmail = emailLines.join('\r\n');
      const base64Email = Buffer.from(rawEmail)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const messagePayload: any = { raw: base64Email };
      if (args.thread_id || args.threadId) {
        messagePayload.threadId = args.thread_id || args.threadId;
      }

      if (action === 'create_draft') {
        const draftRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: messagePayload }),
        });

        if (!draftRes.ok) {
          return JSON.stringify({ status: 'error', code: draftRes.status, text: await draftRes.text() });
        }
        const draftData = (await draftRes.json()) as any;
        return JSON.stringify({ status: 'ok', message: 'Rascunho criado com sucesso no Gmail.', draftId: draftData.id });
      }

      const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
      });

      if (!sendRes.ok) {
        return JSON.stringify({ status: 'error', code: sendRes.status, text: await sendRes.text() });
      }
      const sendData = (await sendRes.json()) as any;
      return JSON.stringify({ status: 'ok', message: 'E-mail enviado com sucesso.', messageId: sendData.id });
    }

    // 3. LIST CONVERSATIONS/THREADS (MIRRORS EXACT GMAIL UI CONVERSATIONS)
    const limit = Math.min(Math.max(Number(args.max_results || args.limit) || 50, 1), 100);
    const folder = args.folder || 'inbox';

    let queryParts: string[] = [];
    if (folder === 'inbox' && (!args.query || (!args.query.includes('in:') && !args.query.includes('label:')))) {
      queryParts.push('in:inbox');
    } else if (folder === 'sent') {
      queryParts.push('in:sent');
    } else if (folder === 'starred') {
      queryParts.push('is:starred');
    }

    if (args.query && args.query.trim()) {
      queryParts.push(args.query.trim());
    }

    const finalQueryString = queryParts.join(' ');
    const qParam = finalQueryString ? `&q=${encodeURIComponent(finalQueryString)}` : '';
    const labelParam = folder === 'inbox' ? '&labelIds=INBOX' : '';

    // Fetch THREADS from Gmail API (matches Gmail Web UI 1-to-1)
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=${limit}${labelParam}${qParam}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!listRes.ok) {
      return JSON.stringify({ status: 'error', code: listRes.status, text: await listRes.text() });
    }

    const data = (await listRes.json()) as any;
    const threadList = data.threads || [];

    const detailed = (
      await Promise.all(
        threadList.map(async (t: any) => {
          try {
            const detailRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            if (detailRes.ok) {
              const d = (await detailRes.json()) as any;
              const msgs = d.messages || [];
              const lastMsg = msgs[msgs.length - 1];
              const headers = lastMsg?.payload?.headers || [];
              const getHeader = (hn: string) =>
                headers.find((h: any) => h.name.toLowerCase() === hn.toLowerCase())?.value || '';

              const isUnread = msgs.some((m: any) => m.labelIds && m.labelIds.includes('UNREAD'));

              return {
                id: lastMsg?.id || t.id,
                thread_id: t.id,
                from: getHeader('From'),
                to: getHeader('To'),
                subject: getHeader('Subject'),
                date: getHeader('Date'),
                messagesInThread: msgs.length,
                isUnread,
                snippet: t.snippet || lastMsg?.snippet || '',
              };
            }
          } catch {}
          return null;
        })
      )
    ).filter(Boolean);

    return JSON.stringify({
      status: 'ok',
      folder,
      totalConversations: detailed.length,
      estimatedTotal: data.resultSizeEstimate,
      conversations: detailed,
    });
  },
};
