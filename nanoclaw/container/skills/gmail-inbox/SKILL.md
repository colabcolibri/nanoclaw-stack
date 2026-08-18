---
name: gmail-inbox
description: Advanced Gmail inbox search, filter operations, full email reading, and thread replies via Gmail API.
domain: google_suite
tools:
  - google_gmail
keywords:
  - email
  - gmail
  - inbox
  - messages
  - unread
  - mail
---

# Gmail Inbox & Executive Search Skill

This skill guides the agent to execute advanced searches, read email conversations in threads, create drafts, and send replies directly within existing email threads.

## 🔍 Gmail Search Operator Guide (`query`):

Translate user requests into native Gmail search queries:

| User Intent | Recommended `query` |
| :--- | :--- |
| **"Unread emails about contracts"** | `is:unread subject:contract` |
| **"Unread emails from specific senders"** | `is:unread from:client@company.com` |
| **"Recent emails with attachments"** | `newer_than:2d has:attachment` |
| **"Unread primary emails excluding promotions"** | `is:unread -category:promotions` |
| **"Invoices, bills, or payment slips"** | `boleto OR fatura OR pagar OR vencimento OR invoice` |
| **"Quotes, proposals, or order inquiries"** | `orçamento OR pedido OR proposta OR quote` |
| **"Emails with PDFs or spreadsheets"** | `filename:pdf OR filename:xlsx newer_than:7d` |
| **"Important financial emails"** | `is:important from:finance` |

---

## 🛠️ Standard Workflow & Operations:

1. **Search & Listing:** Use `list_messages` with combined `query` and adequate `max_results`.
2. **Deep Reading:** Use `read_message(message_id)` to retrieve complete message body and thread details.
3. **Thread Replies:** When drafting (`create_draft`) or sending (`send_message`), **ALWAYS pass `thread_id` and `message_id`** to preserve conversation continuity.
4. **Source Links:** Always extract and present links (e.g. portal URLs, invoices, payment documents) found in the email bodies.
