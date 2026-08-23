---
name: google-calendar
description: Read and write Google Calendar events via google_calendar API.
domain: google_suite
tools:
  - google_calendar
keywords:
  - agenda
  - calendario
  - calendário
  - calendar
  - compromisso
  - reuniao
  - reunião
  - evento
  - semana
---

# Google Calendar

OAuth is pre-configured. CALL `google_calendar` — never ask the user for OAuth or manual event lists.

## Decision map

| User intent | `action` | Params |
| :--- | :--- | :--- |
| Day agenda | `list_events` | `date` = `YYYY-MM-DD` |
| Week / range | `list_events` | `start_time`, `end_time` (ISO 8601, user TZ) |
| Search by title | `search_events` | `query` |
| Create event | `create_event` | `start_time`, `end_time`, optional `location`, `description` |
| List calendars | `list_calendars` | — |

## Rules

1. Default `calendar_id`: `"primary"` unless user names another.
2. Use context timezone when formatting times for summary.
3. Never invent events — only API results.
4. DONE + table (time, title, location). No greetings.
