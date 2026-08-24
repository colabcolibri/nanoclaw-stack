---
name: autonomous-scheduler
description: Persistent cron routines, delayed one-shot tasks, and follow-ups via ncl tasks. Not host crontab.
domain: automation_scheduling
tools:
  - run_command
---

# Autonomous scheduler

Persistence = `ncl tasks` only. Containers are ephemeral — host `crontab` does not wake the agent.

Use the instance timezone from the `<context timezone="..."/>` header for naive local times. Cron expressions follow the group's timezone (same as `ncl tasks create --help`).

## Decision map

| User intent | Command |
| :--- | :--- |
| Recurring job (cron) | `ncl tasks create --name "<short label>" --recurrence "<5-field cron>" --prompt "<self-contained instruction>"` |
| One-shot after delay | `ncl tasks create --name "<short label>" --process-after "<ISO or local time>" --prompt "<instruction>"` |
| List active schedules | `ncl tasks list` |
| Inspect runs / failures | `ncl tasks get <series-id>` |
| Change schedule or prompt | `ncl tasks update <series-id> --recurrence "..."` and/or `--prompt "..."` |
| Pause / resume | `ncl tasks pause <series-id>` / `ncl tasks resume <series-id>` |
| Cancel | `ncl tasks cancel <series-id>` |
| Fire once now (test) | `ncl tasks run <series-id>` |

## Cron examples (group timezone)

| Pattern | Expression |
| :--- | :--- |
| Every 2 hours | `0 */2 * * *` |
| Daily 09:00 | `0 9 * * *` |
| Weekdays 11:00 | `0 11 * * 1-5` |

## Execution rules

1. CALL `run_command` with `ncl tasks …` before claiming create/update/cancel.
2. SUCCESS only when the command exits 0 and output is not an error. Report `series_id` / task id, cron, `process_after`, `next_run` when present.
3. `ncl tasks list` → pending/paused series only. Do not confuse with past runs (`ncl tasks get` for history).
4. NEVER `crontab` / `/etc/cron.d` / SDK cron builtins.
5. Task `prompt` must be self-contained: which tools to call, where to deliver (`telegram`, etc.), what to report. Example: `Check unread Gmail via google_gmail; summarize; send summary to telegram.`
6. Frequent polling needs a `--script` gate — see `ncl tasks create --help`. Do not override recurrence limits without user consent.
7. DONE + structured summary. No user small-talk.
