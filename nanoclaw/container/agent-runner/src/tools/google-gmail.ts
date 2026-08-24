import fs from 'fs';
import path from 'path';
import type { AgentTool } from './types.js';
import { getGoogleToken } from './google-auth.js';
import { resolveUiPublicUrl } from '../runtime-paths.js';

// External Gmail API response shapes (minimum fields actually accessed).

interface GmailHeader {
  name: string;
  value?: string;
}

interface GmailBody {
  data?: string;
}

interface GmailPayload {
  headers?: GmailHeader[];
  body?: GmailBody;
  parts?: GmailPayload[];
  mimeType?: string;
}

interface GmailMessage {
  id: string;
  threadId?: string;
  snippet?: string;
  labelIds?: string[];
  payload?: GmailPayload;
}

interface GmailProfileResponse {
  emailAddress?: string;
}

interface GmailDraftResponse {
  id?: string;
  message: GmailMessage;
}

interface GmailDraftListResponse {
  drafts?: GmailDraftResponse[];
}

interface GmailThreadResponse {
  id?: string;
  threadId?: string;
  snippet?: string;
  labelIds?: string[];
  payload?: GmailPayload;
  messages?: GmailMessage[];
}

interface GmailThreadSummary {
  id?: string;
  snippet?: string;
}

interface GmailThreadListResponse {
  nextPageToken?: string;
  threads?: GmailThreadSummary[];
}

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

function extractBody(payload?: GmailPayload): string {
  if (!payload) return '';
  if (payload.body?.data) {
    const raw = decodeBase64Url(payload.body.data);
    return raw.includes('<html') || raw.includes('<div') || raw.includes('<head') ? cleanHtml(raw) : raw;
  }
  if (payload.parts && Array.isArray(payload.parts)) {
    const plainPart = payload.parts.find((p) => p.mimeType === 'text/plain');
    if (plainPart?.body?.data) {
      return decodeBase64Url(plainPart.body.data);
    }
    const htmlPart = payload.parts.find((p) => p.mimeType === 'text/html');
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

export interface GmailToolArgs {
  action?: string;
  folder?: string;
  query?: string;
  max_results?: number;
  limit?: number;
  thread_id?: string;
  threadId?: string;
  message_id?: string;
  id?: string;
  draft_id?: string;
  draftId?: string;
  to?: string;
  subject?: string;
  body?: string;
  from_alias?: string;
  in_reply_to?: string;
  rfc_message_id?: string;
  reply_to_message_id?: string;
  force_approved?: boolean;
  operator_approved?: boolean;
  page_token?: string;
  [key: string]: unknown;
}

function gmailHeader(headers: GmailHeader[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

export const googleGmailTool: AgentTool = {
  domain: 'google_suite',
  definition: {
    type: 'function',
    function: {
      name: 'google_gmail',
      description: 'List and read Gmail messages, create drafts, and send replies.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list_messages', 'read_message', 'create_draft', 'send_message', 'list_drafts', 'delete_draft'],
            description: 'Action: "list_messages" (search/inbox), "read_message" (read thread/body), "create_draft" (create draft), "send_message" (send reply).',
          },
          folder: {
            type: 'string',
            enum: ['inbox', 'sent', 'starred', 'all'],
            description: 'Mailbox folder (default: inbox).',
          },
          query: {
            type: 'string',
            description: 'Gmail search filter (e.g. "is:unread", "newer_than:2d", "from:x").',
          },
          max_results: {
            type: 'number',
            description: 'Maximum conversations to return (default 8, max 25).',
          },
          thread_id: {
            type: 'string',
            description: 'Thread ID to read or reply to.',
          },
          message_id: {
            type: 'string',
            description: 'Message ID.',
          },
          draft_id: {
            type: 'string',
            description: 'Draft ID.',
          },
          to: {
            type: 'string',
            description: 'Recipient.',
          },
          subject: {
            type: 'string',
            description: 'Subject line.',
          },
          body: {
            type: 'string',
            description: 'Email body.',
          },
          from_alias: {
            type: 'string',
            description: 'From alias or signature line.',
          },
        },
        required: ['action'],
      },
    },
  },
  execute: async (args: GmailToolArgs, cwd: string): Promise<string> => {
    const token = await getGoogleToken(cwd);
    if (!token) {
      return JSON.stringify({
        status: 'error',
        error:
          `Gmail account not connected yet. Connect via "Connect Google Account" in the web panel (${resolveUiPublicUrl()}, MCP Servers tab).`,
      });
    }

    const action = args.action || 'list_messages';

    // 1. DELETE DRAFT
    if (action === 'delete_draft') {
      const draftId = args.draft_id || args.id || args.draftId;
      if (!draftId) {
        return JSON.stringify({ status: 'error', error: 'Parameter "draft_id" is required to delete a draft.' });
      }

      const delRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${draftId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (delRes.status === 204 || delRes.ok) {
        return JSON.stringify({
          status: 'ok',
          message: `Draft ${draftId} deleted from Gmail.`,
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

      const draftsData = (await listDraftsRes.json()) as GmailDraftListResponse;
      const rawDrafts = draftsData.drafts || [];

      const detailedDrafts = await Promise.all(
        rawDrafts.map(async (d) => {
          try {
            const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${d.id}?format=metadata`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (detailRes.ok) {
              const dt = (await detailRes.json()) as GmailDraftResponse;
              const msg = dt.message || {};
              const headers = msg.payload?.headers || [];

              return {
                draft_id: d.id,
                message_id: msg.id,
                thread_id: msg.threadId,
                to: gmailHeader(headers, 'To'),
                subject: gmailHeader(headers, 'Subject'),
                date: gmailHeader(headers, 'Date'),
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
        return JSON.stringify({ status: 'error', error: 'Parameter message_id or thread_id is required.' });
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

      const data = (await res.json()) as GmailThreadResponse;

      let userEmail = '';
      try {
        const profRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (profRes.ok) {
          const prof = (await profRes.json()) as GmailProfileResponse;
          userEmail = (prof.emailAddress || '').toLowerCase();
        }
      } catch {}

      if (isThread && Array.isArray(data.messages) && data.messages.length > 0) {
        const rawMsgs = data.messages;
        const parsedMsgs = rawMsgs.map((m, idx) => {
          const headers = m.payload?.headers || [];
          const fromVal = gmailHeader(headers, 'From');
          const isFromMe = userEmail ? fromVal.toLowerCase().includes(userEmail) : Boolean(m.labelIds?.includes('SENT'));
          const body = extractBody(m.payload) || m.snippet || '';

          return {
            index: idx + 1,
            messageId: m.id,
            rfcMessageId: gmailHeader(headers, 'Message-ID'),
            from: fromVal,
            to: gmailHeader(headers, 'To'),
            subject: gmailHeader(headers, 'Subject'),
            date: gmailHeader(headers, 'Date'),
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
          previousMessages: previousMsgs.map((p) => ({
            from: p.from,
            date: p.date,
            snippet: p.snippet,
            isFromMe: p.isFromMe,
          })),
        });
      }

      // Single message fallback
      const headers = data.payload?.headers || [];
      const bodyText = extractBody(data.payload) || data.snippet || '';
      const fromVal = gmailHeader(headers, 'From');
      const isFromMe = userEmail ? fromVal.toLowerCase().includes(userEmail) : Boolean(data.labelIds?.includes('SENT'));

      return JSON.stringify({
        status: 'ok',
        id: data.id,
        threadId: data.threadId || data.id,
        rfcMessageId: gmailHeader(headers, 'Message-ID'),
        totalMessagesInThread: 1,
        from: fromVal,
        to: gmailHeader(headers, 'To'),
        subject: gmailHeader(headers, 'Subject'),
        date: gmailHeader(headers, 'Date'),
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
          message: 'EMAIL POLICY ACTIVE (notify-only): Gmail send and draft creation is disabled by system policy.',
        });
      }

      if (!args.to || !args.subject || !args.body) {
        return JSON.stringify({
          status: 'error',
          error: 'Parameters "to", "subject", and "body" are required for send/draft.',
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
            const origData = (await origRes.json()) as GmailMessage;
            targetThreadId = targetThreadId || origData.threadId || origData.id;
            const origHeaders = origData.payload?.headers || [];
            parentRfcMessageId = parentRfcMessageId || gmailHeader(origHeaders, 'Message-ID');
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
        const draftData = (await draftRes.json()) as GmailDraftResponse;
        return JSON.stringify({
          status: isInterceptedToDraft ? 'draft_created_for_approval' : 'ok',
          message: isInterceptedToDraft
            ? 'DETERMINISTIC SAFETY LOCK ACTIVE: Draft & Approval mode is on. The message was saved as a Gmail draft in the same thread for Telegram approval before final send.'
            : 'Draft created successfully in the Gmail thread.',
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
      const sendData = (await sendRes.json()) as GmailMessage;
      return JSON.stringify({
        status: 'ok',
        message: 'Email sent successfully in thread.',
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

    const data = (await listRes.json()) as GmailThreadListResponse;
    const threadList = data.threads || [];

    const detailed = (
      await Promise.all(
        threadList.map(async (t) => {
          try {
            const detailRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            if (detailRes.ok) {
              const d = (await detailRes.json()) as GmailThreadResponse;
              const msgs = d.messages || [];
              const lastMsg = msgs[msgs.length - 1];
              const headers = lastMsg?.payload?.headers || [];

              const isUnread = msgs.some((m) => m.labelIds && m.labelIds.includes('UNREAD'));
              let snip = (t.snippet || lastMsg?.snippet || '').trim();
              if (snip.length > 120) snip = snip.slice(0, 117) + '...';

              return {
                id: lastMsg?.id || t.id,
                thread_id: t.id,
                from: gmailHeader(headers, 'From'),
                subject: gmailHeader(headers, 'Subject') || '(Sem assunto)',
                date: gmailHeader(headers, 'Date'),
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
