---
name: gmail-inbox
description: Gmail search, read threads, drafts and replies via google_gmail API.
domain: google_suite
tools:
  - google_gmail
---

# Gmail inbox

OAuth is pre-configured. CALL `google_gmail` — never ask the user for auth links.

## Decision map

| User intent | Typical flow |
| :--- | :--- |
| Unread / inbox scan | `list_messages` + `query` (e.g. `is:unread`) |
| Read one thread | `read_message` with `message_id` |
| Search by topic/sender | `query` with Gmail operators (see table) |
| Draft / send reply | `create_draft` or `send_message` with `thread_id` + `message_id` |

## Query operators

| Intent | `query` |
| :--- | :--- |
| Unread | `is:unread` |
| Unread + subject | `is:unread subject:contract` |
| From sender | `is:unread from:user@domain.com` |
| Recent + attachment | `newer_than:2d has:attachment` |
| Invoices | `boleto OR fatura OR invoice OR vencimento` |
| PDF / spreadsheet | `filename:pdf OR filename:xlsx newer_than:7d` |

## Rules

1. CALL tool before summarizing mail. Never invent subjects or senders.
2. Replies: always pass `thread_id` and `message_id` for continuity.
3. Include portal/invoice links from body when present.
4. DONE + structured list (from, subject, date, needs_reply). No greetings.
