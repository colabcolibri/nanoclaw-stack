import fs from 'fs';
import path from 'path';
import type { AgentTool } from './types.js';
import { getGoogleToken } from './google-auth.js';

export interface EmailPolicy {
  mode: 'draft_approval' | 'auto_safe' | 'notify_only';
  signature?: string;
  forwardToTelegram?: boolean;
  autoMarkAsRead?: boolean;
}

export function loadEmailPolicy(cwd?: string): EmailPolicy {
  const defaults: EmailPolicy = {
    mode: 'draft_approval',
    signature: process.env.EMAIL_DEFAULT_SIGNATURE || '',
    forwardToTelegram: true,
    autoMarkAsRead: false,
  };

  const possiblePaths = [
    cwd ? path.join(cwd, 'email_policy.json') : null,
    '/workspace/group/email_policy.json',
    '/workspace/agent/email_policy.json',
    process.env.AGENT_GROUP_DIR ? path.join(process.env.AGENT_GROUP_DIR, 'email_policy.json') : null,
  ].filter(Boolean) as string[];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        return {
          mode: data.mode || defaults.mode,
          signature: data.signature || defaults.signature,
          forwardToTelegram: data.forwardToTelegram ?? defaults.forwardToTelegram,
          autoMarkAsRead: data.autoMarkAsRead ?? defaults.autoMarkAsRead,
        };
      } catch {}
    }
  }
  return defaults;
}

function decodeBase64Url(data: string): string {
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

function cleanHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBody(payload: any): string {
  if (!payload) return '';
  if (payload.body?.data) {
    const raw = decodeBase64Url(payload.body.data);
    return raw.includes('<html') || raw.includes('<div') || raw.includes('<head') ? cleanHtml(raw) : raw;
  }
  if (payload.parts && Array.isArray(payload.parts)) {
    const plainPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
    if (plainPart?.body?.data) {
      return decodeBase64Url(plainPart.body.data);
    }
    const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
    if (htmlPart?.body?.data) {
      return cleanHtml(decodeBase64Url(htmlPart.body.data));
    }
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }
  return '';
}

function stripEmailQuotesAndBoilerplate(text: string): string {
  if (!text) return '';
  let cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\n(?:On\s.+?wrote|Em\s.+?escreveu):[\s\S]*/i, '')
    .replace(/^\s*>+.*$/gm, '')
    .replace(/This email and any files transmitted with it are confidential[\s\S]*/i, '')
    .replace(/Esta mensagem contém informações confidenciais[\s\S]*/i, '')
    .trim();
  if (cleaned.length > 1800) {
    cleaned = cleaned.slice(0, 1797) + '...';
  }
  return cleaned;
}

/**
 * Formats email body to ensure continuous flowing text per paragraph without
 * awkward line-breaks/enters in the middle of sentences.
 */
function formatEmailBody(raw: string): string {
  if (!raw) return '';
  const normalized = stripEmailQuotesAndBoilerplate(raw);
  const paragraphs = normalized.split(/\n\s*\n/);

  const cleanedParagraphs = paragraphs.map((para) => {
    const lines = para.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return '';

    // If it's a bulleted or numbered list, preserve line structure
    const isList = lines.every((l) => /^[-*•\d+.]\s+/.test(l));
    if (isList) {
      return lines.join('\n');
    }

    // Otherwise, join lines into a single flowing sentence block
    return lines.join(' ');
  });

  return cleanedParagraphs.filter(Boolean).join('\n\n');
}

export const googleGmailTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'google_gmail',
      description:
        'Accesses Gmail to list conversation threads, search messages, read full message/thread contents, create drafts, send email replies in the same thread, list drafts, or delete drafts.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list_messages', 'read_message', 'create_draft', 'send_message', 'list_drafts', 'delete_draft'],
            description:
              'Action to perform: "list_messages" (list inbox/search conversations), "read_message" (read full email content by message_id or thread_id), "create_draft" (create a draft in thread), "send_message" (send email in thread), "list_drafts" (list all existing drafts), "delete_draft" (delete a draft by draft_id).',
          },
          folder: {
            type: 'string',
            enum: ['inbox', 'sent', 'starred', 'all'],
            description: 'Folder to query (default: "inbox").',
          },
          query: {
            type: 'string',
            description:
              'Gmail search operators (e.g. "is:unread", "newer_than:3d", "from:user@example.com", "subject:quote"). Default searches within Inbox.',
          },
          max_results: {
            type: 'number',
            description: 'Maximum number of conversations to return (default 50, max 100).',
          },
          message_id: {
            type: 'string',
            description: 'Message ID or Thread ID to read or reply to.',
          },
          thread_id: {
            type: 'string',
            description: 'Thread ID to reply within (ensures response stays in the exact same conversation thread).',
          },
          draft_id: {
            type: 'string',
            description: 'Draft ID to delete (required for delete_draft).',
          },
          to: {
            type: 'string',
            description: 'Recipient email address for sending or creating a draft.',
          },
          subject: {
            type: 'string',
            description: 'Subject line of the email.',
          },
          body: {
            type: 'string',
            description: 'Text content/body of the email (will be formatted as continuous flowing text).',
          },
          from_alias: {
            type: 'string',
            description: 'Sender alias/signature to use (e.g. "Assistente Virtual da Colibri <contato@colabcolibri.com>").',
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

    // 1. DELETE DRAFT
    if (action === 'delete_draft') {
      const draftId = args.draft_id || args.id || args.draftId;
      if (!draftId) {
        return JSON.stringify({ status: 'error', error: 'Parâmetro "draft_id" é obrigatório para excluir um rascunho.' });
      }

      const delRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${draftId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (delRes.status === 204 || delRes.ok) {
        return JSON.stringify({
          status: 'ok',
          message: `Rascunho ${draftId} excluído com sucesso do Gmail.`,
        });
      }

      return JSON.stringify({
        status: 'error',
        code: delRes.status,
        text: await delRes.text(),
      });
    }

    // 2. LIST DRAFTS
    if (action === 'list_drafts') {
      const limit = Math.min(Math.max(Number(args.max_results || args.limit) || 20, 1), 50);
      const listDraftsRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts?maxResults=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!listDraftsRes.ok) {
        return JSON.stringify({ status: 'error', code: listDraftsRes.status, text: await listDraftsRes.text() });
      }

      const draftsData = (await listDraftsRes.json()) as any;
      const rawDrafts = draftsData.drafts || [];

      const detailedDrafts = await Promise.all(
        rawDrafts.map(async (d: any) => {
          try {
            const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${d.id}?format=metadata`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (detailRes.ok) {
              const dt = (await detailRes.json()) as any;
              const msg = dt.message || {};
              const headers = msg.payload?.headers || [];
              const getH = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

              return {
                draft_id: d.id,
                message_id: msg.id,
                thread_id: msg.threadId,
                to: getH('To'),
                subject: getH('Subject'),
                date: getH('Date'),
                snippet: msg.snippet || '',
              };
            }
          } catch {}
          return { draft_id: d.id, message_id: d.message?.id };
        })
      );

      return JSON.stringify({
        status: 'ok',
        totalDrafts: detailedDrafts.length,
        drafts: detailedDrafts,
      });
    }

    // 3. READ MESSAGE OR THREAD
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

      let userEmail = '';
      try {
        const profRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (profRes.ok) {
          const prof = (await profRes.json()) as any;
          userEmail = (prof.emailAddress || '').toLowerCase();
        }
      } catch {}

      if (isThread && Array.isArray(data.messages) && data.messages.length > 0) {
        const rawMsgs = data.messages;
        const parsedMsgs = rawMsgs.map((m: any, idx: number) => {
          const headers = m.payload?.headers || [];
          const getH = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
          const fromVal = getH('From');
          const isFromMe = userEmail ? fromVal.toLowerCase().includes(userEmail) : Boolean(m.labelIds?.includes('SENT'));
          const body = extractBody(m.payload) || m.snippet || '';

          return {
            index: idx + 1,
            messageId: m.id,
            rfcMessageId: getH('Message-ID'),
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
          lastRfcMessageId: lastMsg.rfcMessageId,
          lastMessageId: lastMsg.messageId,
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
      const isFromMe = userEmail ? fromVal.toLowerCase().includes(userEmail) : Boolean(data.labelIds?.includes('SENT'));

      return JSON.stringify({
        status: 'ok',
        id: data.id,
        threadId: data.threadId || data.id,
        rfcMessageId: getHeader('Message-ID'),
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

    // 4. CREATE DRAFT OR SEND MESSAGE (WITH THREAD CONTINUITY & CLEAN CONTINUOUS TEXT)
    if (action === 'create_draft' || action === 'send_message') {
      const policy = loadEmailPolicy(cwd);

      if (policy.mode === 'notify_only') {
        return JSON.stringify({
          status: 'policy_blocked',
          message: 'POLÍTICA DE E-MAIL ATIVA (Apenas Notificar): O envio ou criação de rascunhos pelo Gmail está desativado pela política do sistema.',
        });
      }

      if (!args.to || !args.subject || !args.body) {
        return JSON.stringify({
          status: 'error',
          error: 'Parâmetros "to", "subject" e "body" são obrigatórios para envio/rascunho.',
        });
      }

      const isExplicitApproved = Boolean(args.force_approved || args.operator_approved);
      const isInterceptedToDraft = action === 'send_message' && policy.mode === 'draft_approval' && !isExplicitApproved;
      const effectiveAction = isInterceptedToDraft ? 'create_draft' : action;

      // Clean body into continuous flowing text
      const cleanBody = formatEmailBody(args.body);

      // Thread continuity lookup
      let parentRfcMessageId = args.in_reply_to || args.rfc_message_id || '';
      let targetThreadId = args.thread_id || args.threadId || '';
      const refMsgId = args.message_id || args.reply_to_message_id;

      if ((!parentRfcMessageId || !targetThreadId) && refMsgId) {
        try {
          const origRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${refMsgId}?format=metadata`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (origRes.ok) {
            const origData = (await origRes.json()) as any;
            targetThreadId = targetThreadId || origData.threadId || origData.id;
            const origHeaders = origData.payload?.headers || [];
            const getH = (name: string) => origHeaders.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
            parentRfcMessageId = parentRfcMessageId || getH('Message-ID');
          }
        } catch {}
      }

      // If replying, ensure Subject starts with "Re: "
      let subjectLine = args.subject.trim();
      if (targetThreadId && !/^re:\s*/i.test(subjectLine)) {
        subjectLine = `Re: ${subjectLine}`;
      }

      const utf8Subject = `=?utf-8?B?${Buffer.from(subjectLine).toString('base64')}?=`;
      const fromAlias = args.from_alias || policy.signature || 'Assistente Virtual da Colibri <contato@colabcolibri.com>';

      const emailLines: string[] = [
        `From: ${fromAlias}`,
        `To: ${args.to}`,
        `Subject: ${utf8Subject}`,
      ];

      // Insert RFC 2822 In-Reply-To and References for perfect email client thread grouping
      if (parentRfcMessageId) {
        emailLines.push(`In-Reply-To: ${parentRfcMessageId}`);
        emailLines.push(`References: ${parentRfcMessageId}`);
      }

      emailLines.push('Content-Type: text/plain; charset="UTF-8"');
      emailLines.push('Content-Transfer-Encoding: 8bit');
      emailLines.push('');
      emailLines.push(cleanBody);

      const rawEmail = emailLines.join('\r\n');
      const base64Email = Buffer.from(rawEmail)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const messagePayload: any = { raw: base64Email };
      if (targetThreadId) {
        messagePayload.threadId = targetThreadId;
      }

      if (effectiveAction === 'create_draft') {
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
        return JSON.stringify({
          status: isInterceptedToDraft ? 'draft_created_for_approval' : 'ok',
          message: isInterceptedToDraft
            ? 'TRAVA DE SEGURANÇA DETERMINÍSTICA ATIVA: O modo "Rascunho & Aprovação" está ativo. A mensagem foi gravada como Rascunho na mesma thread do Gmail para aprovação prévia no Telegram antes do envio definitivo.'
            : 'Rascunho criado com sucesso na thread do Gmail.',
          draftId: draftData.id,
          threadId: draftData.message?.threadId || targetThreadId,
        });
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
      return JSON.stringify({
        status: 'ok',
        message: 'E-mail enviado com sucesso na thread.',
        messageId: sendData.id,
        threadId: sendData.threadId || targetThreadId,
      });
    }

    // 5. LIST CONVERSATIONS/THREADS (TOKEN OPTIMIZED WITH DYNAMIC LIMIT & PAGINATION)
    const limit = Math.min(Math.max(Number(args.max_results || args.limit) || 15, 1), 100);
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
    const pageTokenParam = args.page_token ? `&pageToken=${encodeURIComponent(args.page_token)}` : '';

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=${limit}${labelParam}${qParam}${pageTokenParam}`,
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
              let snip = (t.snippet || lastMsg?.snippet || '').trim();
              if (snip.length > 120) snip = snip.slice(0, 117) + '...';

              return {
                id: lastMsg?.id || t.id,
                thread_id: t.id,
                from: getHeader('From'),
                subject: getHeader('Subject') || '(Sem assunto)',
                date: getHeader('Date'),
                unread: isUnread,
                snippet: snip,
              };
            }
          } catch {}
          return null;
        })
      )
    ).filter(Boolean);

    return JSON.stringify({
      status: 'ok',
      totalReturned: detailed.length,
      nextPageToken: data.nextPageToken || undefined,
      threads: detailed,
    });
  },
};
