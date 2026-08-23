---
name: autonomous-scheduler
description: Persistent cron routines, delayed one-shot tasks, and follow-ups via schedule_followup. Not host crontab.
domain: notion_management
tools:
  - schedule_followup
---

# Autonomous scheduler

Persistence = `schedule_followup` only. Containers are ephemeral — host `crontab` does not wake the agent.

## Decision map

| User intent | `action` | Required params |
| :--- | :--- | :--- |
| Recurring job (cron) | `schedule_recurring_routine` | `cron` (5-field UTC), `prompt` (autonomous instruction for wake-up) |
| One-shot after delay | `schedule_delayed_task` | `delay_minutes` or `run_at` (ISO), `prompt` |
| List active schedules | `list_scheduled_tasks` | — |
| Change routine | `update_recurring_routine` | `task_id` (optional), `cron` and/or `prompt` |
| Cancel | `cancel_task` | `task_id` |

## Cron (UTC, 5 fields)

| Pattern | Expression |
| :--- | :--- |
| Every 2 hours | `0 */2 * * *` |
| Daily 09:00 UTC | `0 9 * * *` |
| Weekdays 11:00 UTC | `0 11 * * 1-5` |

## Execution rules

1. CALL `schedule_followup` before claiming create/update/cancel.
2. SUCCESS only if response contains `"status": "ok"`. Report `task_id`, cron, `process_after` when present.
3. `list_scheduled_tasks` → pending routines only. Do not confuse with past runs.
4. NEVER `run_command` / `crontab` / `/etc/cron.d`.
5. Wake `prompt` must be self-contained (which tools to call, what to report). Example: `Check unread Gmail via google_gmail; summarize; notify user.`
6. DONE + structured summary. No user small-talk.
